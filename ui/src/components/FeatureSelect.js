import { Checkbox, List } from "antd";
import React from 'react';

export default function FeatureSelect({ data, processed, selectedDims, selectedPoints, setSelectedDims, featureData, setFeatureData }) {
  const handleCheckboxChange = (key) => {
    const existingColumns = Object.keys(featureData);
    if (!existingColumns.includes(key)) {
        fetch(`http://127.0.0.1:5010/nodeData/${key}`)
            .then(response => response.json())
            .then(newData => {
                if (newData.data.length === featureData[Object.keys(featureData)[0]].length) {
                    const processedColumn = newData.data.map(row => ({
                        value: row[key],  
                        timestamp: new Date(row.timestamp), 
                        nodeId: row.nodeId
                    }));    
                    setFeatureData(featureData => ({
                        ...featureData,
                        [key]: processedColumn  // new column
                    }));
                } else {
                    console.error(`Data length mismatch: expected ${processed[Object.keys(processed)[0]].length}, got ${newData.data.length}`);
                }
            })
            .catch(error => console.error('Error fetching data:', error));
    }
    setSelectedDims(prevSelectedDims => {
        if (prevSelectedDims.includes(key)) {
            return prevSelectedDims.filter(dim => dim !== key);
        } else {
            return [...prevSelectedDims, key];
        }
    });
  }
  
  return (
    <List
      style={{ width: "100%", maxWidth: 500, overflowY: "scroll", maxHeight: 450, marginRight: "10px" }}
      bordered
      dataSource={data.features}
      renderItem={(key, index) => {
      return (
          <List.Item key={key} style={{ display: "flex", alignItems: "center", padding: "5px 10px" }}>
          
          <div style={{display: 'flex', flexDirection: 'column'}}>
              <div style={{display: 'flex'}}>
                  <Checkbox
                      checked={selectedDims.includes(key)}
                      onChange={() => handleCheckboxChange(key)}
                      style={{ marginRight: "10px" }}
                  />
                  <span style={{ flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {key}
                  </span>
              </div>
              <svg style={{width: '100%', height: 100}}></svg>
          </div>
          </List.Item>
      );
      }}
    />
  )
}