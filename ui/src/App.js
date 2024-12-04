import React, { useEffect, useState } from 'react';
import { fetchData } from './utils/api.js';
import './App.css';
import AreaChart from './components/areachart.js';
import Window from './components/window.js';
import Dropdown from './components/dropdown.js';

function App() {

  const [mgrData, setMgrData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [triggerData, setTriggerData] = useState([]);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState([]);
  const [field, setField] = useState("Activity_P1");

  useEffect(() => {
    const getMgrData = async () => {
      try {
        const response = await fetch('http://localhost:5009/mgrData');
        const data = await response.json();
        
        if (response.ok) {
          setMgrData(data);  
          setError(null); 
          setFields(Object.keys(data));  
          const trigFilt = Object.keys(data)
            .filter((key) => key.includes('P1'))
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
          setFields([]); 
          setTriggerData(null);   
          setPerfData(null);   
          setError("Failed to fetch data. Please check that the server is running.");
        }
      } catch (error) {
        setMgrData(null);    
        setFields([]);  
        setTriggerData(null);
        setPerfData(null);
        setError("Failed to fetch data. Please check that the server is running.");
        console.error(error);     
      }
    };
    getMgrData();
  }, []);

  return (
    <div className="App">
      {error ? (
        <header className="App-header">
          <p>{error}</p>
      </header>)
      : (
        <div className="wrapper_main">
           <div className="wrapper_top">
              <div className="view_title">Data Selection</div>
              <Dropdown />
              <Window data={mgrData} />
            </div>
          <div className="wrapper_bottom">
            <div className="wrapper_left">
              <div className="view_title">Performance</div>
                {Object.keys(perfData).map((field) => (
                  <AreaChart key={field} data={perfData} field={field} />
                ))}
            </div>
            <div className="wrapper_left">
              <div className="view_title">Triggers</div>
                {Object.keys(triggerData).map((field) => (
                  <AreaChart key={field} data={triggerData} field={field} />
                ))}
            </div>
            <div className="wrapper_right">
                <div className="view_title">MS Plot</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
