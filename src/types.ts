export const METHOD_ANY = 'any';
export const METHODS = [
  METHOD_ANY,
  'get',
  'post',
  'patch',
  'delete',
  'option',
  'head',
  'trace',
] as const;
export type Method = typeof METHODS[number];

export type Params = { [key: string]: string };
export type Handler = <T extends Params = {}>(
  req: Request,
  params?: T
) => Response | Promise<Response>;

type StaticTestFragment = {
  type: 'static';
  name: string;
};
type DynamicTestFragment = {
  type: 'dynamic';
  name: string;
};
type IgnoreAfterTestFragment = {
  type: 'ignore_after';
};
export type PathTestFragment =
  | StaticTestFragment
  | DynamicTestFragment
  | IgnoreAfterTestFragment;

export type StaticRoute = {
  method: Method;
  path: string;
  handler: Handler;
};
export type DynamicRoute = {
  method: Method;
  rawPath: string;
  tests: PathTestFragment[];
  handler: Handler;
};
