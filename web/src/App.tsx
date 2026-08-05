import React from 'react';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import { LoginScreen } from './components/LoginScreen';
import { LayoutView } from './components/LayoutView';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useLayout();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <LayoutView />;
};

export default function App() {
  return (
    <LayoutProvider>
      <AppContent />
    </LayoutProvider>
  );
}
