import React, { useEffect, useState } from 'react';
// import { fetchData } from './utils/api.js';
import { Tab, Tabs, Box } from '@mui/material';
import './App.css';
import AreaChart from './components/areachart.js';
import Window from './components/window.js';
import Dropdown from './components/dropdown.js';
import Coordinates from './components/coordinates.js';
import DR from './components/dr.js';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [farmData, setFarmData] = useState(null);
  const [drData, setDRData] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [triggerData, setTriggerData] = useState([]);
  const [error, setError] = useState(null);
  const [farmFile, setFarmFile] = useState('farm/novadaq-far-farm-01.json');
  const [selectedFile, setSelectedFile] = useState('mgr/novadaq-far-mgr-01-full.json');

  useEffect(() => {
    Promise.all([getDRData(), getMgrData(selectedFile)])
      .then(() => console.log("Data fetched successfully"))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  const getFarmData = async(filePath) => {
    try {
      const response = await fetch(`http://localhost:5009/farmData?file=${filePath}`);
      const data = await response.json();
      
      if (response.ok) {
        setFarmData(data);
        setError(null); 
      } else {
        setFarmData(null);  
        setError("Failed to fetch node data. Please check that the server is running.");
      }
    } catch (error) {
      setFarmData(null);    
      setError("Failed to fetch node data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getDRData = async () => {
    try {
      const response = await fetch(`http://localhost:5009/drData`);
      const data = await response.json();
      
      if (response.ok) {
        setDRData(data);
        setError(null); 
      } else {
        setDRData(null);  
        setError("Failed to fetch DR data. Please check that the server is running.");
      }

    } catch (error) {
      setDRData(null);    
      setError("Failed to fetch DR data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getMgrData = async (filePath) => {
    if (!filePath) return;
    try {
      const response = await fetch(`http://localhost:5009/mgrData?file=${filePath}`);
      const data = await response.json();
      
      if (response.ok) {
        setMgrData(data);  
        setError(null); 
        const trigFilt = Object.keys(data)
          .filter((key) => (
              key.includes('P1') &&
              (key.includes('Data Driven') || (key.includes('Trigger'))) &&
              !key.includes('Activity') &&
              !key.includes('prescale')
            ))
          .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
          }, {});

      // Filter data for performance (keys not containing 'P1')
      const perfFilt = Object.keys(data)
        .filter((key) => !key.includes('P1'))
        .reduce((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {});

      setTriggerData(trigFilt);
      setPerfData(perfFilt)

      } else {
        setMgrData(null);  
        setTriggerData(null);   
        setPerfData(null);   
        setError("Failed to fetch manager data. Please check that the server is running.");
      }
    } catch (error) {
      setMgrData(null);    
      setTriggerData(null);
      setPerfData(null);
      setError("Failed to fetch manager data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const onFileChange = (newFile) => {
    setSelectedFile(newFile); 
    getMgrData(newFile);
  };

  const onTabChange = (event, newTab) => {
      setActiveTab(newTab);
  }

  return (
    <div className="App">
      {error ? (
        <header className="App-header">
          <p>{error}</p>
        </header>
      ) : (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#f5f5f5' }}>
            <Tabs
              value={activeTab}
              onChange={onTabChange}
              textColor="primary"
              indicatorColor="primary"
              centered
            >
              <Tab label="Static Analysis" />
              <Tab label="Streaming Analysis" />
            </Tabs>
          </Box>

          {activeTab === 0 && (
            <div className="wrapper_app">
              <div className="wrapper_main">
                <div className="wrapper_top">
                  <div className="view_title" style={{ width: '120px' }}>
                    Timeline View
                  </div>
                  {/* <Dropdown selectedFile={selectedFile} onFileChange={(e) => setSelectedFile(e.target.value)} /> */}
                  {mgrData ? (
                    <Window mgrData={mgrData} />
                  ) : (
                    <p>Loading data...</p>
                  )}
                </div>
                <div className="wrapper_bottom">
                  <div className="wrapper_left">
                    <div className="view_title" style={{ width: '120px' }}>
                      Performance Metrics
                    </div>
                    {Object.keys(perfData).map((field, index) => (
                      <AreaChart key={field} data={perfData} field={field} index={index} chartType="perf" />
                    ))}
                  </div>
                  <div className="wrapper_left">
                    <div className="view_title" style={{ width: '50px' }}>
                      Triggers
                    </div>
                    {Object.keys(triggerData).map((field, index) => (
                      <AreaChart key={field} data={triggerData} field={field} index={index} chartType="trigger" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="wrapper_right">
                <div className="wrapper_top2">
                  <div className="view_title" style={{ width: '50px' }}>
                    DR
                  </div>
                  {drData ? (
                    <DR data={drData} />
                  ) : (
                    <p>Loading DR results...</p>
                  )}
                </div>
                <div className="wrapper_bottom2">
                  <div className="view_title" style={{ width: '80px' }}>
                    Buffer Nodes
                  </div>
                  {drData ? (
                    <Coordinates data={drData} />
                  ) : (
                    <p>Loading DR results...</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="streaming-analysis">
              <p>This is the Streaming Analysis tab. Implement streaming logic here.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
