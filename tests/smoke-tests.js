// ValiStruct 2.0 smoke tests (manual/browser)
const checks = [
  ["parseCSV", typeof parseCSV === "function"],
  ["Aiken", typeof calculateAiken === "function" || typeof calculateAikenV === "function"],
  ["Reliability", typeof calculateReliability === "function" || typeof runReliability === "function"],
  ["AFE", typeof efaCorrelationMatrix === "function"],
  ["CFA", typeof estimateCfaPrototype === "function"],
  ["SEM editor", typeof renderSem === "function"],
  ["APA report", typeof generateApaReport === "function"],
  ["Guided assistant", typeof buildAssistantPlan === "function"]
];
console.table(checks.map(([name,ok])=>({name,ok})));
