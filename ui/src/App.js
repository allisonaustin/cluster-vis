import React, { useEffect, useState } from 'react';
// import { fetchData } from './utils/api.js';
import './App.css';
import AreaChart from './components/areachart.js';
import Window from './components/window.js';
import Dropdown from './components/dropdown.js';
import Matrix from './components/matrix.js';
import Bubble from './components/bubblechart.js';

function App() {
  const [farmData, setFarmData] = useState(null);
  const [mgrData, setMgrData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [triggerData, setTriggerData] = useState([]);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState('mgr/novadaq-far-mgr-01-full.json');

  useEffect(() => {
    Promise.all([getFarmData(), getMgrData(selectedFile)])
      .then(() => console.log("Data fetched successfully"))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  const getFarmData = async () => {
    try {
      const response = await fetch('http://localhost:5009/farmData');
      const data = await response.json();
      
      if (response.ok) {
        const farmFilt = Object.keys(data)
          .filter((key) => (
              !key.includes('P0') &&
              !key.includes('P2') &&
              !key.includes('P3') &&
              !key.includes('Trigger') &&
              !key.includes('Data Driven') &&
              !key.includes('rate') &&
              !key.includes('delay') &&
              !key.includes('RC') &&
              !key.includes('Activity') &&
              !key.includes('prescale')
          ))
          .reduce((obj, key) => {
            obj[key] = Object.entries(data[key]).map(([compositeKey, value]) => {
                const [timestamp, nodeId] = compositeKey
                    .replace(/[()]/g, '') 
                    .split(', ')        
                    .map(item => item.trim().replace(/['"]/g, "")); 
                return {
                    timestamp: new Date(timestamp.replace('Timestamp', '').trim()).getTime(), 
                    nodeId,
                    value, 
                };
            });
            return obj;
          }, {});
        setFarmData(farmFilt);  
        setError(null); 
      } else {
        setFarmData(null);  
        setError("Failed to fetch farm data. Please check that the server is running.");
      }
    } catch (error) {
      setFarmData(null);    
      setError("Failed to fetch farm data. Please check that the server is running.");
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

  return (
    <div className="App">
      {error ? (
        <header className="App-header">
          <p>{error}</p>
      </header>)
      : (
        <div className="wrapper_app"> 
          <div className="wrapper_main">
            <div className="wrapper_top">
                <div className="view_title" style={{width: "120px"}}>Manager Node</div>
                <Dropdown selectedFile={selectedFile} onFileChange={onFileChange}/>
                <Window data={mgrData} />
              </div>
            <div className="wrapper_bottom">
              <div className="wrapper_left">
                <div className="view_title" style={{width: "120px"}}>Performance Metrics</div>
                  {Object.keys(perfData).map((field, index) => (
                    <AreaChart key={field} data={perfData} field={field} index={index} chartType={'perf'} />
                  ))}
              </div>
              <div className="wrapper_left">
                <div className="view_title" style={{width: "50px"}}>Triggers</div>
                  {Object.keys(triggerData).map((field, index) => (
                    <AreaChart key={field} data={triggerData} field={field} index={index} chartType={'trigger'} />
                  ))}
              </div>
            </div> 
          </div>
          <div className="wrapper_right">
              <div className="wrapper_top2">
                <div className="view_title" style={{width: "50px"}}>Triggers</div>
                  <Bubble data={triggerData}/>
              </div>
              <div className="wrapper_bottom2">
                <div className="view_title" style={{width: "80px"}}>Buffer Nodes</div>
                  {farmData ? (
                      <Matrix data={farmData} />
                    ) : (
                      <p>Loading farm data...</p>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
