;; XMBL Bridge Contract for Stacks
;; Handles cross-chain NFT bridging between Stacks and Base networks via Wormhole

(define-constant ERR_NOT_OWNER u100)
(define-constant ERR_TOKEN_BRIDGED u101)
(define-constant ERR_TOKEN_NOT_OWNED u102)
(define-constant ERR_INVALID_BRIDGE u103)
(define-constant ERR_MESSAGE_ALREADY_PROCESSED u104)

;; Data Variables
(define-data-var owner (optional principal) none)
(define-data-var bridge-contract (optional principal) none)
(define-data-var token-contract principal tx-sender)
(define-data-var base-chain-id uint u0)

;; Maps
(define-map bridged-tokens { id: uint } bool)
(define-map processed-messages { message-id: (buff 32) } bool)

;; Events
(define-event (bridge-initiated-event (token-id uint) (owner principal) (target-chain uint)))
(define-event (bridge-completed-event (source-token-id uint) (target-token-id uint) (recipient principal)))
(define-event (bridge-failed-event (token-id uint) (reason (string-ascii 100))))

;; Initialize contract
(define-public (initialize (contract-owner principal) (token-contract-addr principal))
  (let ((current-owner (var-get owner)))
    (asserts! (is-none current-owner) (err u105))
    (var-set owner (some contract-owner))
    (var-set token-contract token-contract-addr)
    (ok true)
  )
)

;; Bridge NFT from Stacks to Base
(define-public (bridge-to-base (token-id uint))
  (let ((current-owner (unwrap! (var-get owner) (err ERR_NOT_OWNER))))
    ;; Verify token exists and user owns it (via token contract)
    ;; Note: In actual implementation, would query token contract
    (let ((is-bridged (map-get? bridged-tokens { id: token-id })))
      (asserts! (is-none is-bridged) (err ERR_TOKEN_BRIDGED))
      
      ;; Mark token as bridged
      (map-set bridged-tokens { id: token-id } true)
      
      ;; Emit bridge event (off-chain service will handle Wormhole message)
      (emit (bridge-initiated-event token-id tx-sender base-chain-id))
      
      (ok true)
    )
  )
)

;; Receive NFT from Base (called by off-chain service after Wormhole message)
(define-public (receive-from-base (message-id (buff 32)) (source-token-id uint) (recipient principal) (token-price uint))
  (let ((bridge-principal (unwrap! (var-get bridge-contract) (err ERR_INVALID_BRIDGE))))
    (asserts! (is-eq tx-sender bridge-principal) (err ERR_INVALID_BRIDGE))
    
    ;; Check message not already processed
    (let ((processed (map-get? processed-messages { message-id: message-id })))
      (asserts! (is-none processed) (err ERR_MESSAGE_ALREADY_PROCESSED))
      
      ;; Mark message as processed
      (map-set processed-messages { message-id: message-id } true)
      
      ;; Call token contract to mint NFT (requires token contract to have bridge mint function)
      ;; For now, emit event that token contract will handle
      (emit (bridge-completed-event source-token-id u0 recipient))
      
      (ok true)
    )
  )
)

;; Check if token is bridged
(define-read-only (is-bridged (token-id uint)))
  (map-get? bridged-tokens { id: token-id })
)

;; Unlock token after failed bridge (owner only)
(define-public (unlock-token (token-id uint))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (map-delete bridged-tokens { id: token-id })
  (ok true)
)

;; Set bridge contract (for message verification)
(define-public (set-bridge-contract (bridge-principal principal))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set bridge-contract (some bridge-principal))
  (ok true)
)

;; Set base chain ID
(define-public (set-base-chain-id (chain-id uint))
  (asserts! (is-eq tx-sender (unwrap! (var-get owner) (err ERR_NOT_OWNER))) (err ERR_NOT_OWNER))
  (var-set base-chain-id chain-id)
  (ok true)
)

