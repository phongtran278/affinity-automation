export const FIELD_STATE = Object.freeze({
  REQUIRED: "REQUIRED",
  OPTIONAL: "OPTIONAL",
  DERIVED: "DERIVED",
  NOT_APPLICABLE: "NOT_APPLICABLE"
});

export function isRequired(state){
  return state === FIELD_STATE.REQUIRED;
}
