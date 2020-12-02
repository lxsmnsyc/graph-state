import { trigger } from '../global';
import { SWRGraphNodeBaseOptions } from '../types';
import IS_CLIENT from '../utils/is-client';

const INITIALIZED = new Map<string, boolean>();

function registerPassiveNetworkRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
): void {
  if (options.revalidateOnNetwork) {
    window.addEventListener('online', onRevalidate, false);
  }
}

function registerPassiveVisibilityRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
): void {
  if (options.revalidateOnVisibility) {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onRevalidate();
      }
    }, false);
  }
}

function registerPassiveFocusRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
): void {
  if (options.revalidateOnFocus) {
    window.addEventListener('focus', onRevalidate, false);
  }
}

function registerPassiveRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
): void {
  registerPassiveNetworkRevalidation(options, onRevalidate);
  registerPassiveVisibilityRevalidation(options, onRevalidate);
  registerPassiveFocusRevalidation(options, onRevalidate);
}

function registerActiveBlurRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
  refreshInterval: number,
): void {
  if (options.refreshWhenBlurred) {
    let interval: number;

    window.addEventListener('blur', () => {
      clearInterval(interval);
      interval = window.setInterval(onRevalidate, refreshInterval);
    }, false);
    window.addEventListener('focus', () => {
      clearInterval(interval);
    }, false);
  }
}

function registerActiveOfflineRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
  refreshInterval: number,
): void {
  if (options.refreshWhenOffline) {
    let interval: number;
    window.addEventListener('offline', () => {
      clearInterval(interval);
      interval = window.setInterval(onRevalidate, refreshInterval);
    }, false);
    window.addEventListener('online', () => {
      clearInterval(interval);
    }, false);
  }
}

function registerActiveHiddenRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
  refreshInterval: number,
): void {
  if (options.refreshWhenHidden) {
    let interval: undefined | number;

    window.addEventListener('visibilitychange', () => {
      clearInterval(interval);
      if (document.visibilityState === 'visible') {
        interval = undefined;
      } else {
        interval = window.setInterval(onRevalidate, refreshInterval);
      }
    }, false);
  }
}

function registerActivePollRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
  refreshInterval: number,
): void {
  if (
    !(options.refreshWhenHidden
    || options.refreshWhenBlurred
    || options.refreshWhenOffline)
  ) {
    window.setInterval(onRevalidate, refreshInterval);
  }
}

function registerActiveRevalidation<T>(
  options: SWRGraphNodeBaseOptions<T>,
  onRevalidate: () => void,
  refreshInterval?: number,
) {
  if (refreshInterval) {
    registerActiveBlurRevalidation(options, onRevalidate, refreshInterval);
    registerActiveOfflineRevalidation(options, onRevalidate, refreshInterval);
    registerActiveHiddenRevalidation(options, onRevalidate, refreshInterval);
    registerActivePollRevalidation(options, onRevalidate, refreshInterval);
  }
}

function registerEventRevalidation<T>(
  key: string,
  options: SWRGraphNodeBaseOptions<T>,
  refreshInterval?: number,
) {
  const onRevalidate = () => {
    trigger(key);
  };

  registerPassiveRevalidation(options, onRevalidate);
  registerActiveRevalidation(options, onRevalidate, refreshInterval);
}

export default function registerRevalidation<T>(
  key: string,
  options: SWRGraphNodeBaseOptions<T>,
  refreshInterval?: number,
): void {
  if (!IS_CLIENT || INITIALIZED.has(key)) {
    return;
  }
  INITIALIZED.set(key, true);
  registerEventRevalidation(key, options, refreshInterval);
}
