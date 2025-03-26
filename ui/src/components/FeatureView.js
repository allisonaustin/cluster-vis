import React, { useState, useEffect, useRef } from 'react';
import { getColor } from '../utils/colors.js';
import { Card, List, Checkbox } from "antd";
import * as d3 from 'd3';
import LineChart from './LineChart.js';

const FeatureView = ({ data, selectedDims, selectedPoints }) => {
  const dims = selectedDims.filter(field => data && data.length > 0 && field in data[0]);

  return (
      <div>
          {dims.map((field, index) => (
              <LineChart 
                  key={`chart-${index}`}
                  data={data} 
                  field={field} 
                  index={index} 
                  selectedPoints={selectedPoints}
              />
          ))}
      </div>
    );
};
    
export default FeatureView;