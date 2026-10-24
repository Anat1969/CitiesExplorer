import { lazy, Suspense, useEffect } from 'react';
import AllCases from './components/AllCases';
import Board from './components/Board';
import CasePage from './components/CasePage';
import ComparePage from './components/ComparePage';
import Home from './components/Home';
import MovePage from './components/MovePage';
import MovesPage from './components/MovesPage';
import PresentPage from './components/PresentPage';
import ProblemPage from './components/ProblemPage';
import ProjectPage from './components/ProjectPage';
import TopBar from './components/TopBar';
import { caseById } from './data/cases';
import { moveById } from './data/moves';
import { problemById } from './data/problems';
import { useRoute, type Route } from './lib/route';

// The map carries the world geometry: load it only when opened.
const MapPage = lazy(() => import('./components/MapPage'));

const TITLES: Partial<Record<Route['view'], string>> = {
  board: 'לוח השראה',
  all: 'כל המקרים',
  moves: 'מטריצת המהלכים',
  map: 'מפה וזמן',
  project: 'הפרויקט שלי',
  compare: 'השוואה',
  present: 'מצגת',
};

function Page({ route }: { route: Route }) {
  switch (route.view) {
    case 'case':
      return <CasePage id={route.case!} from={route.problem} />;
    case 'problem':
      return <ProblemPage id={route.problem!} />;
    case 'all':
      return <AllCases route={route} />;
    case 'board':
      return <Board />;
    case 'moves':
      return <MovesPage />;
    case 'move':
      return <MovePage id={route.move!} />;
    case 'map':
      return (
        <Suspense fallback={<main className="page"><p className="lede">טוען את המפה...</p></main>}>
          <MapPage />
        </Suspense>
      );
    case 'project':
      return <ProjectPage route={route} />;
    case 'compare':
      return <ComparePage route={route} />;
    case 'present':
      return <PresentPage route={route} />;
    default:
      return <Home />;
  }
}

export default function App() {
  const route = useRoute();

  useEffect(() => {
    const base = 'ערים מעוררות השראה';
    const name =
      route.view === 'case' ? caseById(route.case!)?.name : route.view === 'problem' ? problemById(route.problem!)?.title : route.view === 'move' ? moveById(route.move!)?.title : TITLES[route.view];
    document.title = name ? `${name} | ${base}` : base;
  }, [route]);

  return (
    <>
      <TopBar route={route} />
      <Page route={route} />
      <footer className="footer">
        <p>ערים מעוררות השראה. העובדות נבדקו מול המקורות המצורפים לכל מקרה, ומסומנות כמאומתות או משוערות. לפני שימוש במסמך רשמי יש לבדוק במקור.</p>
        <p className="mono">אד' ענת שטיבלמן A&amp;I</p>
      </footer>
    </>
  );
}
