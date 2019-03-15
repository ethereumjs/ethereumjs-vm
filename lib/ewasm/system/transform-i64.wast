;; This module aims to temporarily shim required missing features in wasm-js-api
;; to allow integration of ewasm in js. An example of that is the lack of support
;; for i64 values in the interface between wasm and js.
;; It currently implements only those shims necessary for a few precompiles, but will
;; have to be extended to support the full EEI interface.
(module
  (import "interface" "useGas" (func $useGas (param i32 i32)))

  (export "useGas" (func $useGasShim))

  ;; Use gas takes a i64 parameter `amount`. This shim takes the i64 value
  ;; and breaks it into two 32 bit values `high` and `low` which js can natively
  ;; support.
  (func $useGasShim
    (param $amount i64)
    (call $useGas
      (i32.wrap/i64 (i64.shr_u (get_local $amount) (i64.const 32)))
      (i32.wrap/i64 (get_local $amount))
    )
  )
)
