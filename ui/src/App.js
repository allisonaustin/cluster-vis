import React, { useEffect, useState } from 'react';
import { fetchData } from './utils/api.js';
import './App.css';
import AreaChart from './components/areachart.js';

function App() {

  const [mgrData, setMgrData] = useState(null);
  const [error, setError] = useState(null);
  const [field, setField] = useState("Activity_P1");

  useEffect(() => {
    const getMgrData = async () => {
      try {
        const response = await fetch('http://localhost:5009/mgrData');
        const data = await response.json();
        
        if (response.ok) {
          setMgrData(data);  
          setError(null);        
        } else {
          setMgrData(null);         
          setError("Failed to fetch data. Please check that the server is running.");
        }
      } catch (error) {
        setMgrData(null);      
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
          <div className="wrapper_left">
              <div className='view_title'>{field}</div>
                <AreaChart data={mgrData} field={field} />
          </div>
          <div className="wrapper_right">
              <div className="view_title">MS Plot</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
