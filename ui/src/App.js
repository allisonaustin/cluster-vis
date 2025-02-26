import React, { useEffect, useState } from 'react';
// import { fetchData } from './utils/api.js';
import './App.css';
import AreaChart from './components/AreaChart.js';
import TimelineView from './components/TimelineView.js';
import Coordinates from './components/CoordinateView.js';
import DR from './components/DRView.js';

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [farmData, setFarmData] = useState(null);
  const [DRFData, setDRFData] = useState(null);
  const [DRTData, setDRTData] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [triggerData, setTriggerData] = useState([]);
  const [error, setError] = useState(null);
  const [farmFile, setFarmFile] = useState('farm/novadaq-far-farm-01.json');
  const [selectedFile, setSelectedFile] = useState('mgr/novadaq-far-mgr-01-full.json');
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);


  useEffect(() => {
    Promise.all([getDRTimeData(), 
                getDRFeatureData(),
                getMgrData(selectedFile)
              ])
      .then(() => console.log("Data fetched successfully"))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  const getDRFeatureData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drFeatureDataCSV`);
      const data = await response.json();
      
      if (response.ok) {
        setDRFData(data);
        setError(null); 
      } else {
        setDRFData(null);  
        setError("Failed to fetch DR data. Please check that the server is running.");
      }

    } catch (error) {
      setDRFData(null);    
      setError("Failed to fetch DR data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getDRTimeData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5010/drTimeDataCSV`);
      const data = await response.json();
      
      if (response.ok) {
        setDRTData(data);
        setError(null); 
      } else {
        setDRTData(null);  
        setError("Failed to fetch DR data. Please check that the server is running.");
      }

    } catch (error) {
      setDRTData(null);    
      setError("Failed to fetch DR data. Please check that the server is running.");
      console.error(error);     
    }
  };

  const getMgrData = async (filePath) => {
    if (!filePath) return;
    try {
      const response = await fetch(`http://127.0.0.1:5010/mgrData`);
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
          <div className="wrapper_app">
            <div className="wrapper_main">
              <div className="wrapper_top">
                <div className="view_title" style={{ width: '120px' }}>
                  Timeline View
                </div>
                {mgrData ? (
                  <TimelineView 
                    mgrData={mgrData} 
                  />
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
                    <AreaChart 
                      key={field} 
                      data={perfData} 
                      field={field} 
                      index={index} 
                      chartType="perf" 
                    />
                  ))}
                </div>
                <div className="wrapper_left">
                  <div className="view_title" style={{ width: '50px' }}>
                    Triggers
                  </div>
                  {Object.keys(triggerData).map((field, index) => (
                    <AreaChart 
                      key={field} 
                      data={triggerData} 
                      field={field} 
                      index={index} 
                      chartType="trigger"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="wrapper_right">
              <div className="wrapper_top2">
                <div className="view_title" style={{ width: '70px' }}>
                  DR View
                </div>
                <div id="dr-container" style={{display: 'flex', flexDirection: 'row', minWidth: 150, marginLeft: 20  }}>
                    {DRTData ? (
                        <DR 
                          data={DRTData} 
                          type="time" 
                          setSelectedPoints={setSelectedPoints} 
                          selectedPoints={selectedPoints} 
                          hoveredPoint={hoveredPoint} 
                          setHoveredPoint={setHoveredPoint} 
                        />
                      ) : (
                        <p>Loading DR time view...</p>
                      )}
                      {DRFData ? (
                        <DR 
                          data={DRFData}  
                          type="feature" 
                          setSelectedPoints={setSelectedPoints} 
                          selectedPoints={selectedPoints} 
                          hoveredPoint={hoveredPoint} 
                          setHoveredPoint={setHoveredPoint} 
                        />
                      ) : (
                        <div style={{marginBottom: '15px'}}>
                          <p>Loading DR feature view...</p>
                        </div>
                      )}
                </div>
              </div>
              <div className="wrapper_bottom2">
                <div className="view_title" style={{ width: '100px' }}>
                  Coordinate Plot
                </div>
                {DRTData ? (
                  <Coordinates 
                    data={DRTData} 
                    selectedPoints={selectedPoints} 
                    setSelectedPoints={setSelectedPoints} 
                    hoveredPoint={hoveredPoint} 
                    setHoveredPoint={setHoveredPoint} 
                  />
                ) : (
                  <p>Loading DR results...</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
