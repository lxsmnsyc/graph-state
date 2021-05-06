/** @jsx h */
import 'preact/debug';
import { VNode } from 'preact';
import { Suspense } from 'preact/compat';
import {
  resource,
  node,
} from 'graph-state';
import {
  GraphDomain,
  useGraphNodeResource,
  useGraphNodeValue,
  useGraphNodeState,
  useGraphNodeReset,
  useGraphNodeHydrate,
} from 'preact-graph-state';

const temperatureF = node({
  get: 32,
});

const temperatureC = node<number, number, void>({
  get: ({ get }) => {
    const fahrenheit = get(temperatureF);

    return ((fahrenheit - 32) * 5) / 9;
  },
  set: ({ set }, newValue) => set(temperatureF, (newValue * 9) / 5 + 32),
});

const sleep = (time: number) => new Promise((resolve) => {
  setTimeout(resolve, time, true);
});

const temperature = node<Promise<string>>({
  get: async ({ get }) => {
    const fahrenheit = get(temperatureF);
    const celsius = get(temperatureC);

    await sleep(1000);

    return `${fahrenheit} vs ${celsius}`;
  },
});

const asyncTemperature = resource(temperature);

function ResetTemperature(): VNode {
  const resetTemperature = useGraphNodeReset(temperatureF);

  return (
    <button type="button" onClick={resetTemperature}>
      Reset
    </button>
  );
}

function Celsius(): VNode {
  const [celsius, setCelsius] = useGraphNodeState(temperatureC);

  return (
    <input
      type="number"
      onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => (
        setCelsius(Number.parseFloat(e.currentTarget.value))
      )}
      value={celsius}
    />
  );
}

function Fahrenheit(): VNode {
  const [fahrenheit, setFahrenheit] = useGraphNodeState(temperatureF);

  return (
    <input
      type="number"
      onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => (
        setFahrenheit(Number.parseFloat(e.currentTarget.value))
      )}
      value={fahrenheit}
    />
  );
}

function Temperature(): VNode {
  const celsius = useGraphNodeValue(temperatureC);
  const fahrenheit = useGraphNodeValue(temperatureF);

  return (
    <>
      <h1>{`Fahrenheit: ${fahrenheit}`}</h1>
      <h1>{`Celsius: ${celsius}`}</h1>
    </>
  );
}

function DelayedTemperature(): VNode {
  const value = useGraphNodeResource(asyncTemperature);

  return <h1>{ value }</h1>;
}

function AsyncTemperature(): VNode {
  const value = useGraphNodeValue(asyncTemperature);

  if (value.status === 'pending') {
    return <h1>Loading...</h1>;
  }
  if (value.status === 'failure') {
    return <h1>Something went wrong.</h1>;
  }
  return <h1>{ value.data }</h1>;
}

const timer = node<number>({
  get: ({ mutateSelf, subscription }) => {
    let count = 0;
    subscription(() => {
      const interval = setInterval(() => {
        count += 1;
        mutateSelf(count);
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    });
    return count;
  },
});

function Timer(): VNode {
  const value = useGraphNodeValue(timer);

  return <h1>{`Time: ${value}`}</h1>;
}

function InnerApp(): VNode {
  useGraphNodeHydrate(temperatureF, 100);

  return (
    <>
      <Fahrenheit />
      <Celsius />
      <ResetTemperature />
      <Temperature />
      <Suspense fallback={<h1>Loading...</h1>}>
        <div>
          <DelayedTemperature />
        </div>
      </Suspense>
      <AsyncTemperature />
      <Suspense fallback={<h1>Loading...</h1>}>
        <div>
          <DelayedTemperature />
        </div>
      </Suspense>
      <Timer />
    </>
  );
}

export default function App(): VNode {
  return (
    <GraphDomain>
      <InnerApp />
    </GraphDomain>
  );
}
