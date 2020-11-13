import { Params, PathTestFragment } from './types';

const DynamicPathTestFragmentRegExp = /^:(?<name>[a-zA-Z0-9_]+)$/;

export const createPathTestFragments = (path: string): PathTestFragment[] => {
  return path.split('/').reduce((acc, value) => {
    if (value === '*') {
      acc.push({
        type: 'ignore_after',
      });
    }
    const matchedName = value.match(DynamicPathTestFragmentRegExp)?.groups
      ?.name;
    if (matchedName == null) {
      acc.push({ type: 'static', name: value });
      return acc;
    }
    acc.push({
      type: 'dynamic',
      name: matchedName,
    });
    return acc;
  }, [] as PathTestFragment[]);
};

export const resolveDynamicPath = <T extends Params>(
  path: string,
  tests: PathTestFragment[]
): T | null => {
  const fragments = path.split('/');
  let result: any = {};
  const N = fragments.length;
  for (let i = 0; i < N; i++) {
    const fragment = fragments[i];
    const test = tests[i];
    if (test.type === 'static') {
      if (test.name !== fragment) {
        return null;
      }
      continue;
    }
    if (test.type === 'ignore_after') {
      return result;
    }
    if (test.type === 'dynamic') {
      if (fragment.length === 0) {
        return null;
      }
      result[test.name] = fragment;
    }
  }
  return result;
};
