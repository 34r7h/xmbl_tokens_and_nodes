;; XMBL Token Contract
;; Implements tokenomics with NFT minting, pricing algorithm, pool management, and token resale on Stacks

(use-trait nft-trait 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nft-trait)
(use-trait sip009-nft-trait 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.sip-009-nft-trait)

;; Constants
(define-constant STARTING_PRICE u1) ;; 1 satoshi
(define-constant MIN_LIQUIDITY_PERCENT u10) ;; 10%
(define-constant MAX_LIQUIDITY_PERCENT u95) ;; 95%
(define-constant TARGET_BTC_FOR_MAX_LIQUIDITY u10000000000) ;; 100 BTC in satoshis (100 * 1e8)
(define-constant SQRT5_PRECISION u2236) ;; sqrt(5) ≈ 2.236, using 2236/1000 for precision
(define-constant PRECISION_MULTIPLIER u1000)

;; Data Variables
(define-data-var owner (optional principal) none)
(define-data-var bridge-contract (optional principal) none)
(define-data-var oracle-contract (optional principal) none)
(define-data-var development-pool principal (default-to tx-sender))
(define-data-var liquidity-pool principal (default-to tx-sender))
(define-data-var tokens-minted uint u0)
(define-data-var current-price uint STARTING_PRICE)
(define-data-var proof-of-faith uint u0) ;; Total BTC deposited in satoshis - synced from oracle
(define-data-var paused bool false)
(define-data-var listed-tokens-count uint u0) ;; Count of tokens currently listed for sale

;; Maps
(define-map nft-owners { id: uint } principal)
(define-map token-prices { id: uint } uint)
(define-map listed-tokens { id: uint } { seller: principal, asking-price: uint }) ;; Tokens listed for resale
(define-map token-list-order { index: uint } uint) ;; Ordered list of token IDs available for purchase
(define-map bridged-tokens { id: uint } bool) ;; Tracks bridged tokens
(define-map cross-chain-token-id { stacks-id: uint } uint) ;; Maps to base token ID

;; Events (SIP-009 NFT events)
(define-event (sip009-nft-transfer-event (id uint) (sender principal) (recipient principal)))
(define-event (nft-mint-event (id uint) (recipient principal) (price uint)))
(define-event (nft-resale-event (id uint) (seller principal) (asking-price uint)))
(define-event (nft-unlisted-event (id uint)))
(define-event (nft-sold-event (id uint) (seller principal) (buyer principal) (price uint)))
(define-event (price-update-event (token-id uint) (price uint)))
(define-event (pool-split-event (dev-amount uint) (liquidity-amount uint) (total-btc uint)))
(define-event (pool-distribution-event (token-id uint) (dev-amount uint) (liquidity-amount uint)))

;; Error Codes
(define-constant ERR_NOT_OWNER u100)
(define-constant ERR_PAUSED u101)
(define-constant ERR_INSUFFICIENT_PAYMENT u102)
(define-constant ERR_INVALID_ADDRESS u103)
(define-constant ERR_TOKEN_NOT_LISTED u104)
(define-constant ERR_TOKEN_NOT_OWNED u105)
(define-constant ERR_TOKEN_ALREADY_LISTED u106)
(define-constant ERR_NO_LISTED_TOKENS u107)

;; Helper: Calculate sqrt(5) approximation
;; sqrt(5) ≈ 2.236, stored as 2236/1000
(define-read-only (get-sqrt5)
  SQRT5_PRECISION
)

;; Calculate price using formula: cost = cost + Math.ceil((cost * Math.sqrt(5)) / (2 * x))
;; Parentheses are important: (cost * sqrt(5)) / (2 * x)
;; Where x = token number (tokens minted + 1)
;; Math.ceil means round up to next integer
(define-read-only (calculate-price (previous-price uint) (token-number uint))
  (if (is-eq token-number u0)
    STARTING_PRICE
    (let (
      ;; Calculate (cost * sqrt(5)) with precision
      (numerator (* previous-price (get-sqrt5)))
      ;; Calculate (2 * x) with precision
      (denominator (* (* u2 token-number) PRECISION_MULTIPLIER))
      ;; Division: (cost * sqrt(5)) / (2 * x)
      (division-result (/ numerator denominator))
      ;; Check remainder for Math.ceil
      (remainder (mod numerator denominator))
      ;; Round up if remainder > 0
      (increase (if (is-gt remainder u0) (+ division-result u1) division-result))
      (new-price (+ previous-price increase))
    )
      ;; Ensure minimum of 1 satoshi
      (if (is-eq new-price u0) u1 new-price)
    )
  )
)

;; Calculate liquidity percentage using logarithmic curve approximation
(define-read-only (calculate-liquidity-percentage (total-btc uint))
  (if (is-eq total-btc u0)
    MIN_LIQUIDITY_PERCENT
    (let (
      (range (- MAX_LIQUIDITY_PERCENT MIN_LIQUIDITY_PERCENT))
      ;; Calculate progress using cubic root approximation for log-like curve
      (normalized (* (/ (* total-btc PRECISION_MULTIPLIER) TARGET_BTC_FOR_MAX_LIQUIDITY) PRECISION_MULTIPLIER))
      (progress (if (is-ge total-btc TARGET_BTC_FOR_MAX_LIQUIDITY)
        PRECISION_MULTIPLIER
        (if (is-le normalized (* PRECISION_MULTIPLIER PRECISION_MULTIPLIER))
          (/ normalized PRECISION_MULTIPLIER)
          PRECISION_MULTIPLIER
        )
      ))
      (clamped-progress (if (is-gt progress PRECISION_MULTIPLIER) PRECISION_MULTIPLIER progress))
      (liquidity-increase (/ (* range clamped-progress) PRECISION_MULTIPLIER))
      (liquidity-percent (+ MIN_LIQUIDITY_PERCENT liquidity-increase))
    )
      ;; Clamp final result
      (if (is-gt liquidity-percent MAX_LIQUIDITY_PERCENT)
        MAX_LIQUIDITY_PERCENT
        (if (is-lt liquidity-percent MIN_LIQUIDITY_PERCENT)
          MIN_LIQUIDITY_PERCENT
          liquidity-percent
        )
      )
    )
  )
)

;; Helper to shift listings down after removal (recursive)
(define-private (shift-listings-down (from-index uint) (start-shift uint) (end-index uint))
  (if (is-lt start-shift end-index)
    (let ((next-id (map-get? token-list-order { index: start-shift })))
      (if (is-some next-id)
        (begin
          (map-set token-list-order { index: from-index } (unwrap! next-id (err u111)))
          (map-delete token-list-order { index: start-shift })
          (shift-listings-down (+ from-index u1) (+ start-shift u1) end-index)
        )
        true
      )
    )
    true
  )
)

;; Split BTC amount between dev and liquidity pools
(define-read-only (calculate-pool-split (total-btc uint))
  (let (
    (liquidity-percent (calculate-liquidity-percentage total-btc))
    (liquidity-amount (/ (* total-btc liquidity-percent) u100))
    (dev-amount (- total-btc liquidity-amount))
  )
    { liquidity: liquidity-amount, dev: dev-amount }
  )
)

;; Get first available listed token ID (preferred order)
(define-read-only (get-first-listed-token)
  (if (is-eq (var-get listed-tokens-count) u0)
    none
    (map-get? token-list-order { index: u0 })
  )
)

;; Distribute STX to pools (contract must have received STX via separate transfer)
;; Contract transfers from its own balance
;; In as-contract context, tx-sender refers to the contract principal
(define-private (distribute-stx-to-pools (dev-amount uint) (liquidity-amount uint))
  (try! (as-contract (stx-transfer? dev-amount tx-sender (var-get development-pool))))
  (try! (as-contract (stx-transfer? liquidity-amount tx-sender (var-get liquidity-pool))))
  (ok true)
)

;; Buy a listed token (preferred over minting new)
;; Payment must be sent to contract separately before calling this function
(define-public (buy-listed-token (token-id uint) (payment-amount uint))
  (asserts! (not (var-get paused)) (err ERR_PAUSED))
  (let ((listing (map-get? listed-tokens { id: token-id })))
    (asserts! (is-some listing) (err ERR_TOKEN_NOT_LISTED))
    (let ((listing-data (unwrap! listing (err ERR_TOKEN_NOT_LISTED))))
      (let ((seller (get seller listing-data))
            (asking-price (get asking-price listing-data)))
        ;; Verify payment amount matches asking price
        (asserts! (is-eq payment-amount asking-price) (err ERR_INSUFFICIENT_PAYMENT))
        
        ;; Transfer NFT to buyer
        (map-set nft-owners { id: token-id } tx-sender)
        
        ;; Remove from listings
        (map-delete listed-tokens { id: token-id })
        ;; Remove from ordered list (shift remaining items)
        (let ((count (var-get listed-tokens-count)))
          (let ((index-to-remove-opt (find-listing-index token-id count)))
            (if (is-some index-to-remove-opt)
              (begin
                (let ((index-to-remove (unwrap! index-to-remove-opt (err u108))))
                  (map-delete token-list-order { index: index-to-remove })
                  (shift-listings-down index-to-remove (+ index-to-remove u1) count)
                  (var-set listed-tokens-count (- count u1))
                )
              )
            )
          )
        )
        
        ;; Send payment to seller (from contract balance - payment sent separately)
        (try! (as-contract (stx-transfer? asking-price tx-sender seller)))
        
        ;; Emit events
        (emit (nft-sold-event token-id seller tx-sender asking-price))
        (emit (sip009-nft-transfer-event token-id seller tx-sender))
        
        (ok { id: token-id, price: asking-price, seller: seller })
      )
    )
  )
)

;; Helper to find listing index for a token ID
;; Returns none if not found, or (some index) if found
(define-read-only (find-listing-index (token-id uint) (max-index uint))
  (if (is-eq max-index u0)
    none
    (let ((idx (- max-index u1)))
      (let ((listed-id (map-get? token-list-order { index: idx })))
        (if (is-some listed-id)
          (if (is-eq (unwrap! listed-id (err u112)) token-id)
            (some idx)
            (find-listing-index token-id idx)
          )
          (find-listing-index token-id idx)
        )
      )
    )
  )
)

;; Unified buy function: checks listed tokens first, then mints if none available
;; Payment must be sent to contract separately before calling
(define-public (buy (payment-amount uint))
  (asserts! (not (var-get paused)) (err ERR_PAUSED))
  
  ;; Check for available listed tokens first (preferred order)
  (let ((first-listed (get-first-listed-token)))
    (if (is-some first-listed)
      ;; Buy first listed token
      (buy-listed-token (unwrap! first-listed (err ERR_NO_LISTED_TOKENS)) payment-amount)
      ;; No listings available, mint new token
      (mint-new tx-sender payment-amount)
    )
  )
)

;; Mint new NFT for token activation with payment (SIP-009 compliant)
;; Payment amount in microstacks must be >= calculated price
;; Payment must be sent to contract separately before calling
(define-public (mint-new (recipient principal) (payment-amount uint))
  (asserts! (not (var-get paused)) (err ERR_PAUSED))
  
  ;; Calculate token number (current tokens minted + 1)
  (let (
    (token-number (+ (var-get tokens-minted) u1))
    (previous-price (var-get current-price))
    (new-price (calculate-price previous-price token-number))
  )
    ;; Verify payment is sufficient
    (asserts! (is-ge payment-amount new-price) (err ERR_INSUFFICIENT_PAYMENT))
    
    ;; Calculate pool split based on updated proof of faith
    (let (
      (proof-of-faith-new (+ (var-get proof-of-faith) new-price))
      (split (calculate-pool-split proof-of-faith-new))
      (dev-amount (get dev split))
      (liquidity-amount (get liquidity split))
    )
      ;; Update state
      (var-set tokens-minted token-number)
      (var-set current-price new-price)
      (var-set proof-of-faith proof-of-faith-new)
      (map-set nft-owners { id: token-number } recipient)
      (map-set token-prices { id: token-number } new-price)
      
      ;; Distribute payment to pools (contract receives payment via separate transfer)
      (try! (distribute-stx-to-pools dev-amount liquidity-amount))
      
      ;; Emit events
      (emit (nft-mint-event token-number recipient new-price))
      (emit (sip009-nft-transfer-event token-number tx-sender recipient))
      (emit (price-update-event token-number new-price))
      (emit (pool-split-event dev-amount liquidity-amount proof-of-faith-new))
      (emit (pool-distribution-event token-number dev-amount liquidity-amount))
      
      ;; Notify oracle of state update (if oracle contract is set)
      (let ((oracle-principal (var-get oracle-contract)))
        (if (is-some oracle-principal)
          ;; In production, would call oracle contract to update state
          ;; For now, emit event that off-chain service will handle
          true
          true
        )
      )
      
      (ok { id: token-number, price: new-price, dev-amount: dev-amount, liquidity-amount: liquidity-amount })
    )
  )
)

;; List token for resale (token owner can list their token)
(define-public (list-for-sale (token-id uint) (asking-price uint))
  (let ((owner-opt (map-get? nft-owners { id: token-id })))
    (asserts! (is-some owner-opt) (err ERR_TOKEN_NOT_OWNED))
    (let ((current-owner (unwrap! owner-opt (err ERR_TOKEN_NOT_OWNED))))
      (asserts! (is-eq tx-sender current-owner) (err ERR_NOT_OWNER))
      ;; Check not already listed
      (let ((existing-listing (map-get? listed-tokens { id: token-id })))
        (asserts! (is-none existing-listing) (err ERR_TOKEN_ALREADY_LISTED))
        ;; Add to listings
        (map-set listed-tokens { id: token-id } { seller: current-owner, asking-price: asking-price })
        ;; Add to ordered list (FIFO queue)
        (let ((current-count (var-get listed-tokens-count)))
          (map-set token-list-order { index: current-count } token-id)
          (var-set listed-tokens-count (+ current-count u1))
        )
        ;; Emit event
        (emit (nft-resale-event token-id current-owner asking-price))
        (ok true)
      )
    )
  )
)

;; Unlist token (remove from sale)
(define-public (unlist (token-id uint))
  (let ((listing (map-get? listed-tokens { id: token-id })))
    (asserts! (is-some listing) (err ERR_TOKEN_NOT_LISTED))
    (let ((listing-data (unwrap! listing (err ERR_TOKEN_NOT_LISTED))))
      (let ((seller (get seller listing-data)))
        (asserts! (is-eq tx-sender seller) (err ERR_NOT_OWNER))
        ;; Remove from listings
        (map-delete listed-tokens { id: token-id })
        ;; Remove from ordered list
        (let ((count (var-get listed-tokens-count)))
          (let ((index-to-remove-opt (find-listing-index token-id count)))
            (if (is-some index-to-remove-opt)
              (let ((index-to-remove (unwrap! index-to-remove-opt (err u108))))
                (map-delete token-list-order { index: index-to-remove })
                (shift-listings-down index-to-remove (+ index-to-remove u1) count)
                (var-set listed-tokens-count (- count u1))
              )
            )
          )
        )
        ;; Emit event
        (emit (nft-unlisted-event token-id))
        (ok true)
      )
    )
  )
)

;; Get NFT owner (SIP-009)
(define-read-only (get-owner (id uint))
  (map-get? nft-owners { id: id })
)

;; Transfer NFT (SIP-009)
(define-public (transfer (id uint) (sender principal) (recipient principal))
  (let ((current-owner (unwrap! (map-get? nft-owners { id: id }) (err ERR_TOKEN_NOT_OWNED))))
    (asserts! (is-eq tx-sender current-owner) (err ERR_NOT_OWNER))
    ;; Check if token is bridged (prevent transfer)
    (let ((is-bridged (map-get? bridged-tokens { id: id })))
      (asserts! (is-none is-bridged) (err u109))
    )
    ;; If token is listed, remove from listings first
    (let ((listing (map-get? listed-tokens { id: id })))
      (if (is-some listing)
        ;; Remove from listings
        (begin
          (map-delete listed-tokens { id: id })
          ;; Remove from ordered list
          (let ((count (var-get listed-tokens-count)))
            (let ((index-to-remove-opt (find-listing-index id count)))
              (if (is-some index-to-remove-opt)
                (let ((index-to-remove (unwrap! index-to-remove-opt (err u108))))
                  (map-delete token-list-order { index: index-to-remove })
                  (shift-listings-down index-to-remove (+ index-to-remove u1) count)
                  (var-set listed-tokens-count (- count u1))
                )
              )
            )
          )
        )
      )
    )
    (map-set nft-owners { id: id } recipient)
    (emit (sip009-nft-transfer-event id sender recipient))
    (ok true)
  )
)

;; Read-only functions
(define-read-only (get-current-price)
  (var-get current-price)
)

(define-read-only (get-tokens-minted)
  (var-get tokens-minted)
)

(define-read-only (get-proof-of-faith)
  (var-get proof-of-faith)
)

(define-read-only (get-listed-tokens-count)
  (var-get listed-tokens-count)
)

(define-read-only (get-listing (token-id uint))
  (map-get? listed-tokens { id: token-id })
)

(define-read-only (get-all-listings)
  (let ((count (var-get listed-tokens-count)))
    ;; Return list of token IDs that are listed
    ;; Note: Clarity doesn't support dynamic lists, so this is a placeholder
    ;; In practice, you'd query listings via index or use a different pattern
    none
  )
)

;; Owner functions
(define-public (set-development-pool (new-pool principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set development-pool new-pool)
  (ok true)
)

(define-public (set-liquidity-pool (new-pool principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set liquidity-pool new-pool)
  (ok true)
)

(define-public (set-owner (new-owner principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set owner (some new-owner))
  (ok true)
)

(define-public (set-paused (pause bool))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set paused pause)
  (ok true)
)

;; Initialize contract (set owner)
(define-public (initialize (contract-owner principal))
  (let ((current-owner (var-get owner)))
    (asserts! (is-none current-owner) (err u106))
    (var-set owner (some contract-owner))
    (var-set development-pool contract-owner)
    (var-set liquidity-pool contract-owner)
    (ok true)
  )
)

;; Bridge functions
(define-public (set-bridge-contract (bridge-principal principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set bridge-contract (some bridge-principal))
  (ok true)
)

(define-public (set-oracle-contract (oracle-principal principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set oracle-contract (some oracle-principal))
  (ok true)
)

;; Mark token as bridged (only bridge contract)
(define-public (mark-as-bridged (token-id uint))
  (let ((bridge-principal (unwrap! (var-get bridge-contract) (err u110))))
    (asserts! (is-eq tx-sender bridge-principal) (err u110))
    (map-set bridged-tokens { id: token-id } true)
    (ok true)
  )
)

;; Mint NFT from bridge (only bridge contract)
(define-public (mint-from-bridge (recipient principal) (token-id uint) (token-price uint))
  (let ((bridge-principal (unwrap! (var-get bridge-contract) (err u110))))
    (asserts! (is-eq tx-sender bridge-principal) (err u110))
    (map-set nft-owners { id: token-id } recipient)
    (map-set token-prices { id: token-id } token-price)
    (var-set tokens-minted (+ (var-get tokens-minted) u1))
    (emit (nft-mint-event token-id recipient token-price))
    (emit (sip009-nft-transfer-event token-id tx-sender recipient))
    (ok { id: token-id, price: token-price })
  )
)

;; Sync price from oracle (only oracle contract)
(define-public (sync-price-from-oracle (new-price uint))
  (let ((oracle-principal (unwrap! (var-get oracle-contract) (err u111))))
    (asserts! (is-eq tx-sender oracle-principal) (err u111))
    (var-set current-price new-price)
    (ok true)
  )
)

;; Sync proof of faith from oracle (only oracle contract)
(define-public (sync-proof-of-faith-from-oracle (new-proof uint))
  (let ((oracle-principal (unwrap! (var-get oracle-contract) (err u111))))
    (asserts! (is-eq tx-sender oracle-principal) (err u111))
    (var-set proof-of-faith new-proof)
    (ok true)
  )
)

;; Check if token is bridged
(define-read-only (is-bridged (token-id uint))
  (map-get? bridged-tokens { id: token-id })
)
