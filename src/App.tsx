import React, { useState } from 'react';
import Example from './components/LineChart';
import BarChart from './components/BarChart';
import BidirectionalBarChart from './components/BidirectionalChart';
import CoOccurrenceMatrix from './components/Cross-correlation';
import GrangerTestMatrix from './components/GrangerTest';
import DTWMatrix from './components/DTW';
import CoIntegrationMatrix from './components/Co-integration';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

// Adjust the color theme for Material UI
const theme = createTheme({
  palette: {
    primary: {
      main: grey[700],
    },
    secondary: {
      main: grey[700],
    },
  },
});

function Layout() {
  const [activeComponent, setActiveComponent] = useState('Example');

  // Function to render the active component
  const renderActiveComponent = () => {
    switch (activeComponent) {
      case 'Example':
        return <Example />;
      case 'BarChart':
        return <BarChart />;
      case 'BidirectionalChart':
        return <BidirectionalBarChart />;
      case 'CoOccurrenceMatrix':
        return <CoOccurrenceMatrix />;
      case 'GrangerTestMatrix':
        return <GrangerTestMatrix />;
      case 'DTWMatrix':
        return <DTWMatrix />;
      case 'CoIntegrationMatrix':
        return <CoIntegrationMatrix />;
      default:
        return <Example />;
    }
  };

  return (
    <Grid
      container
      spacing={0} // Remove extra spacing
      style={{
        width: '100%',
        margin: 0,
        padding: 0,
        height: '100vh', // Ensure it fills the viewport height
      }}
    >
      {/* Buttons for navigation */}
      <Grid
        item
        xs={12}
        style={{
          padding: '10px',
          margin: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: grey[200],
        }}
      >
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('Example')}
          >
            Default (Line Chart)
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('BarChart')}
          >
            Bar Chart
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('BidirectionalChart')}
          >
            BidirectionalBar Chart
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('CoOccurrenceMatrix')}
          >
            Cross-Correlation
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('GrangerTestMatrix')}
          >
            Granger Test
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('DTWMatrix')}
          >
            DTW
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveComponent('CoIntegrationMatrix')}
          >
            Co-integration
          </Button>
        </Box>
      </Grid>

      {/* Display the active component */}
      <Grid
        item
        xs={12}
        style={{
          padding: 0,
          margin: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%', // Ensure it fills the parent's height
        }}
      >
        {renderActiveComponent()}
      </Grid>
    </Grid>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  );
}

export default App;
