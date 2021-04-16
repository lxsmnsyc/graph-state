/** @jsx h */
import { h } from 'preact';
import { Suspense } from 'preact/compat';
import {
  act, cleanup, render, waitFor,
} from '@testing-library/preact';
import {
  createGraphNode,
  createGraphNodeResource,
} from 'graph-state';
import {
  GraphDomain,
  useGraphNodeResource,
  useGraphNodeValue,
} from '../src';

import { restoreWarnings, supressWarnings } from './suppress-warnings';
import ErrorBound from './error-boundary';

import '@testing-library/jest-dom/extend-expect';
import '@testing-library/jest-dom';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

const sleep = (count: number) => new Promise((resolve) => {
  setTimeout(resolve, count * 1000, true);
});

describe('createGraphNodeResource', () => {
  describe('useGraphNodeValue', () => {
    it('should receive a pending state on initial render.', async () => {
      const finder = 'example';
      const expected = 'Pending';

      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          return 'Hello World';
        },
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeValue(exampleResource);

        return (
          <p title={finder}>
            {
              value.status === 'pending' ? expected : undefined
            }
          </p>
        );
      }

      const result = render(
        <GraphDomain>
          <Consumer />
        </GraphDomain>,
      );

      await act(() => {
        jest.runAllTimers();
      });

      expect(result.getByTitle(finder)).toContainHTML(expected);
    });
    it('should receive a success state upon resolution.', async () => {
      const expected = 'Hello World';

      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          return expected;
        },
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeValue(exampleResource);
        return (
          <p title={value.status}>
            {
              value.status === 'success' ? value.data : undefined
            }
          </p>
        );
      }

      const result = render(
        <GraphDomain>
          <Consumer />
        </GraphDomain>,
      );

      await act(() => {
        jest.runAllTimers();
      });

      expect(await waitFor(() => result.getByTitle('success'))).toContainHTML(expected);
    });
    it('should receive a failure state upon rejection.', async () => {
      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          throw new Error('failed');
        },
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeValue(exampleResource);

        return (
          <p title={value.status}>
            {
              value.status === 'failure' ? 'Error' : undefined
            }
          </p>
        );
      }

      const result = render(
        <GraphDomain>
          <Consumer />
        </GraphDomain>,
      );

      await act(() => {
        jest.runAllTimers();
      });

      expect(await waitFor(() => result.getByTitle('failure'))).toContainHTML('Error');
    });
  });
  describe('useGraphNodeResource', () => {
    it('should receive a pending state on initial render.', () => {
      const finder = 'example';
      const expected = 'Pending';

      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          return 'Hello World';
        },
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeResource(exampleResource);

        return <p title="success">{ value }</p>;
      }

      function Pending(): JSX.Element {
        return <p title={finder}>{expected}</p>;
      }

      const result = render(
        <GraphDomain>
          <Suspense fallback={<Pending />}>
            <Consumer />
          </Suspense>
        </GraphDomain>,
      );

      expect(result.getByTitle(finder)).toContainHTML(expected);
    });
    it('should receive a success state upon resolution.', async () => {
      const expected = 'Hello World';

      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          return expected;
        },
        key: 'Example',
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeResource(exampleResource);

        return <p title="success">{ value }</p>;
      }

      function Pending(): JSX.Element {
        return <p title="pending">Pending</p>;
      }

      const result = render(
        <GraphDomain>
          <Suspense fallback={<Pending />}>
            <Consumer />
          </Suspense>
        </GraphDomain>,
      );

      await act(() => {
        jest.runAllTimers();
      });

      expect(await waitFor(() => result.getByTitle('success'))).toContainHTML(expected);
    });
    it('should receive a failure state upon rejection.', async () => {
      const exampleAsync = createGraphNode({
        get: async () => {
          await sleep(1);
          throw new Error('failed');
        },
      });
      const exampleResource = createGraphNodeResource(exampleAsync);

      function Consumer(): JSX.Element {
        const value = useGraphNodeResource(exampleResource);

        return <p title="success">{ value }</p>;
      }

      function Pending(): JSX.Element {
        return <p title="pending">Pending</p>;
      }

      function Failure(): JSX.Element {
        return <p title="failure">Error</p>;
      }

      supressWarnings();
      const result = render(
        <GraphDomain>
          <ErrorBound fallback={<Failure />}>
            <Suspense fallback={<Pending />}>
              <Consumer />
            </Suspense>
          </ErrorBound>
        </GraphDomain>,
      );

      await act(() => {
        jest.runAllTimers();
      });
      expect(await waitFor(() => result.getByTitle('failure'))).toContainHTML('Error');
      restoreWarnings();
    });
  });
});
