import { useEffect } from 'react';
import AllCases from './components/AllCases';
import Board from './components/Board';
import CasePage from './components/CasePage';
import Home from './components/Home';
import ProblemPage from './components/ProblemPage';
import TopBar from './components/TopBar';
import { caseById } from './data/cases';
import { problemById } from './data/problems';
import { useRoute } from './lib/route';

export default function App() {
  const route = useRoute();

  useEffect(() => {
    const base = 'ערים מעוררות השראה';
    const name = route.view === 'case' ? caseById(route.case!)?.name : route.view === 'problem' ? problemById(route.problem!)?.title : route.view === 'board' ? 'לוח השראה' : route.view === 'all' ? 'כל המקרים' : '';
    document.title = name ? `${name} | ${base}` : base;
  }, [route]);

  return (
    <>
      <TopBar route={route} />
      {route.view === 'case' ? (
        <CasePage id={route.case!} from={route.problem} />
      ) : route.view === 'problem' ? (
        <ProblemPage id={route.problem!} />
      ) : route.view === 'all' ? (
        <AllCases route={route} />
      ) : route.view === 'board' ? (
        <Board />
      ) : (
        <Home />
      )}
      <footer className="footer">
        <p>ערים מעוררות השראה. המידע נאסף כסקירה מקצועית. תאריכים ומספרים יש לאמת במקורות לפני שימוש במסמך רשמי.</p>
        <p className="mono">אד' ענת שטיבלמן A&amp;I</p>
      </footer>
    </>
  );
}
