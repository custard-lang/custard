export function isNonExpressionCall(env: Env, form: Form): form is Call {
  if (!isCall(form)) {
    return false;
  }
  const nonExpressions: (Writer | undefined)[] = [
    Safe.__const,
    Safe.__let,
    Safe.__return,
    Safe.when,
    Unbounded.__while,
  ];
  return nonExpressions.includes(EnvF.find(env, form[0].v));
}
