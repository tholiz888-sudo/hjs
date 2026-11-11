import { createRoot } from 'react-dom/client';
import { Router, usePathname } from './router';
import { ResearchProvider } from '../components/provider';
import { Shell } from '../components/shell';
import Dashboard from '../app/page';
import Rules from '../app/rules/page';
import Backtest from '../app/backtest/page';
function Pages(){const path=usePathname();return path==='/rules'?<Rules/>:path==='/backtest'?<Backtest/>:<Dashboard/>;}
createRoot(document.getElementById('signal-root')!).render(<Router><ResearchProvider><Shell><Pages/></Shell></ResearchProvider></Router>);
