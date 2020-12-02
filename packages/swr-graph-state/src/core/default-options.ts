import { dequal } from 'dequal/lite';
import { SWRGraphNodeBaseOptions } from '../types';

const DEFAULT_OPTIONS: SWRGraphNodeBaseOptions<any> = {
  revalidateOnFocus: false,
  revalidateOnNetwork: false,
  revalidateOnVisibility: false,
  refreshWhenHidden: false,
  refreshWhenBlurred: false,
  refreshWhenOffline: false,
  freshAge: 2000,
  staleAge: 30000,
  compare: dequal,
};

export default DEFAULT_OPTIONS;
