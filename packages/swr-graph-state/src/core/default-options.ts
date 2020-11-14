import { SWRGraphNodeBaseOptions } from '../types';

const DEFAULT_OPTIONS: SWRGraphNodeBaseOptions = {
  revalidateOnFocus: false,
  revalidateOnNetwork: false,
  revalidateOnVisibility: false,
  refreshWhenHidden: false,
  refreshWhenBlurred: false,
  refreshWhenOffline: false,
  freshAge: 2000,
  staleAge: 30000,
};

export default DEFAULT_OPTIONS;
