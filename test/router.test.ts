import { Router } from '../src';
import { METHODS } from '../src/types';
import makeWorkerMock = require('service-worker-mock');

describe('Router', () => {
  beforeEach(() => {
    Object.assign(globalThis, makeWorkerMock());
  });

  describe('append routes', () => {
    const handler = () => new Response();
    test('can append valid paths', () => {
      const valid_paths = [
        '/',
        '/items',
        '/items/',
        '/items/:id',
        '/items/:id/',
        '/items/*',
      ];
      valid_paths.forEach((path) => {
        expect(() => {
          const router = new Router();
          router.get(path, handler);
        }).not.toThrow();
      });
    });

    test('can NOT append invalid paths', () => {
      const invalid_paths = ['', 'items', 'items/', '//', '/:', '/:/', '/*/'];

      invalid_paths.forEach((path) => {
        expect(() => {
          const router = new Router();
          router.get(path, handler);
        }).toThrow();
      });
    });

    test('can NOT append duplicated paths', () => {
      const duplicatedPairs = [
        ['/items', '/items'],
        ['/items/*', '/items/*'],
        ['/items/:id', '/items/:id'],
        ['/items/:id', '/items/:id2'],
      ];

      const nonDuplicatedPairs = [
        ['/:id', '/articles'],
        ['/items/:id', '/items/:id/comments'],
        ['/items/*', '/items/:id'],
        ['/items/:id/comments', '/items/:id/:id2'],
      ];

      duplicatedPairs.forEach((pair) => {
        expect(() => {
          {
            const router = new Router();
            pair.forEach((path) => {
              router.get(path, handler);
            });
          }
          {
            const reversed = pair.slice().reverse();
            const router = new Router();
            reversed.forEach((path) => {
              router.get(path, handler);
            });
          }
        }).toThrow();
      });

      nonDuplicatedPairs.forEach((pair) => {
        expect(() => {
          {
            const router = new Router();
            pair.forEach((path) => {
              router.get(path, handler);
            });
          }
          {
            const router = new Router();
            const reversed = pair.slice().reverse();
            reversed.forEach((path) => {
              router.get(path, handler);
            });
          }
        }).not.toThrow();
      });
    });

    test('can append duplicated paths if their method is different', () => {
      const router = new Router();
      expect(() => {
        router.get('/', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.post('/', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.any('/', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.get('/:id', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.post('/:id', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.any('/:id', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.get('/*', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.post('/*', () => new Response());
      }).not.toThrow();
      expect(() => {
        router.any('/*', () => new Response());
      }).not.toThrow();
    });
  });

  test('route resolving works correctly', async () => {
    const router = new Router();
    const responses = {
      getTop: new Response(),
      getArticle: new Response(),
      getUsers: new Response(),
      getUsersItem: new Response(),
      getUsersSetting: new Response(),
      getUsersSettingTarget: new Response(),
      getUsersFallback: new Response(),
      getAssets: new Response(),
      getStaticAssets: new Response(),
      postArticle: new Response(),
      patchArticle: new Response(),
      anyMethod: new Response(),
      anyMethodDynamic: new Response(),
    };
    router.get('/', async () => responses.getTop);
    router.get('/articles/:id', async () => responses.getArticle);
    router.post('/articles', async () => responses.postArticle);
    router.patch('/articles/:id', async () => responses.patchArticle);
    router.get('/users/*', async () => responses.getUsersFallback);
    router.get('/users/:id', async () => responses.getUsers);
    router.get(
      '/users/:userId/items/:itemId',
      async () => responses.getUsersItem
    );
    router.get('/users/setting', async () => responses.getUsersSetting);
    router.get(
      '/users/setting/:target',
      async () => responses.getUsersSettingTarget
    );
    router.get('/assets/*', async () => responses.getAssets);
    router.get('/assets/x.png', async () => responses.getStaticAssets);
    router.any('/any', async () => responses.anyMethod);
    router.any('/any/:dynamic', async () => responses.anyMethodDynamic);

    let res = await router.handle(new Request('/'));
    expect(res).toEqual(responses.getTop);
    res = await router.handle(new Request('/', { method: 'post' }));
    expect(res.status).toEqual(404);

    res = await router.handle(new Request('/articles/1111'));
    expect(res).toEqual(responses.getArticle);
    res = await router.handle(new Request('/articles', { method: 'post' }));
    expect(res).toEqual(responses.postArticle);
    res = await router.handle(
      new Request('/articles/1111', { method: 'patch' })
    );
    expect(res).toEqual(responses.patchArticle);
    res = await router.handle(new Request('/articles'));
    expect(res.status).toEqual(404);
    res = await router.handle(new Request('/articles/'));
    expect(res.status).toEqual(404);
    res = await router.handle(new Request('/articles/1111/'));
    expect(res.status).toEqual(404);

    res = await router.handle(new Request('/users/1111'));
    expect(res).toEqual(responses.getUsers);
    res = await router.handle(new Request('/users/1111/items/xxxx'));
    expect(res).toEqual(responses.getUsersItem);
    res = await router.handle(new Request('/users/setting'));
    expect(res).toEqual(responses.getUsersSetting);
    res = await router.handle(new Request('/users/setting/xxx'));
    expect(res).toEqual(responses.getUsersSettingTarget);

    res = await router.handle(new Request('/assets/img/icons/user_icon.png'));
    expect(res).toEqual(responses.getAssets);
    res = await router.handle(new Request('/assets/x.png'));
    expect(res).toEqual(responses.getStaticAssets);

    for (let method of METHODS) {
      if (method === 'any') continue;
      const res = await router.handle(new Request('/any', { method }));
      expect(res).toEqual(responses.anyMethod);
    }

    for (let method of METHODS) {
      if (method === 'any') continue;
      const res = await router.handle(new Request('/any/dynamic', { method }));
      expect(res).toEqual(responses.anyMethod);
    }
  });

  describe('dynamic routes parameters', () => {
    test('can get parameters', async () => {
      const router = new Router();
      const value = 'abc123';
      router.get('/articles/:id', (req, params) => {
        expect(params.id).toEqual(value);
        return new Response();
      });
      await router.handle(new Request(`/articles/${value}`));
    });
  });
});
