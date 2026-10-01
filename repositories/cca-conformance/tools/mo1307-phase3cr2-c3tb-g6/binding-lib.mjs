// Pure, fail-closed binding reconciliation reused by the G6 acceptance-only recovery.
// G4 is immutable: this module deliberately re-exports its sealed implementation.
export {
  BINDING_ERROR_CODES,
  BindingValidationError,
  deriveAuthoritativeBinding,
  expectBindingFailure,
} from '../mo1307-phase3cr2-c3tb-g4/binding-lib.mjs';
