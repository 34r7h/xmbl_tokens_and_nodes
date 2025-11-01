;; XMBL Oracle Contract for Stacks
;; Receives state updates from Base oracle and syncs price/proof-of-faith to token contract

(define-constant ERR_NOT_OWNER u100)
(define-constant ERR_NOT_ORACLE u101)
(define-constant ERR_INVALID_CONTRACT u102)

;; Data Variables
(define-data-var owner (optional principal) none)
(define-data-var token-contract principal tx-sender)
(define-data-var oracle-contract (optional principal) none)
(define-data-var base-tokens-minted uint u0)
(define-data-var base-proof-of-faith uint u0)
(define-data-var synced-price uint u1)
(define-data-var synced-proof-of-faith uint u0)

;; Events
(define-event (state-updated-event (base-tokens uint) (base-proof uint) (price uint)))
(define-event (price-synced-event (price uint)))
(define-event (proof-of-faith-synced-event (proof uint)))

;; Initialize contract
(define-public (initialize (contract-owner principal) (token-contract-addr principal))
  (let ((current-owner (var-get owner)))
    (asserts! (is-none current-owner) (err u103))
    (var-set owner (some contract-owner))
    (var-set token-contract token-contract-addr)
    (ok true)
  )
)

;; Update state from Base contract (called by authorized updater or via Wormhole message)
(define-public (update-base-state (tokens-minted uint) (proof-of-faith uint))
  (let ((oracle-principal (var-get oracle-contract)))
    ;; In production, would verify Wormhole message signature here
    ;; For now, allow owner or authorized oracle to update
    (let ((authorized (or 
      (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER)))
      (if (is-some oracle-principal)
        (is-eq tx-sender (unwrap! oracle-principal (err ERR_NOT_ORACLE)))
        false
      )
    )))
      (asserts! authorized (err ERR_NOT_ORACLE))
      
      (var-set base-tokens-minted tokens-minted)
      (var-set base-proof-of-faith proof-of-faith)
      
      (emit (state-updated-event tokens-minted proof-of-faith synced-price))
      (ok true)
    )
  )
)

;; Sync price to token contract
(define-public (sync-price (new-price uint))
  (let ((oracle-principal (var-get oracle-contract)))
    (asserts! (or 
      (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER)))
      (if (is-some oracle-principal)
        (is-eq tx-sender (unwrap! oracle-principal (err ERR_NOT_ORACLE)))
        false
      )
    ) (err ERR_NOT_ORACLE))
    
    (var-set synced-price new-price)
    
    ;; Call token contract to sync price (requires token contract modification)
    ;; For now, emit event
    (emit (price-synced-event new-price))
    (ok true)
  )
)

;; Sync proof of faith to token contract
(define-public (sync-proof-of-faith (new-proof uint))
  (let ((oracle-principal (var-get oracle-contract)))
    (asserts! (or 
      (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER)))
      (if (is-some oracle-principal)
        (is-eq tx-sender (unwrap! oracle-principal (err ERR_NOT_ORACLE)))
        false
      )
    ) (err ERR_NOT_ORACLE))
    
    (var-set synced-proof-of-faith new-proof)
    
    ;; Call token contract to sync proof of faith
    (emit (proof-of-faith-synced-event new-proof))
    (ok true)
  )
)

;; Get aggregated state
(define-read-only (get-aggregated-state)
  { 
    base-tokens: (var-get base-tokens-minted),
    base-proof: (var-get base-proof-of-faith),
    synced-price: (var-get synced-price),
    synced-proof: (var-get synced-proof-of-faith)
  }
)

;; Set oracle contract (for authorization)
(define-public (set-oracle-contract (oracle-principal principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set oracle-contract (some oracle-principal))
  (ok true)
)

