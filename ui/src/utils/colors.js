import * as d3 from 'd3';

export const COLORS = {
    default: '#828080',
    select: '#F6828C',
    highlight: '#4EA5D9'
}

// export const colorScheme = d3.schemeObservable10;
// export const colorScale = d3.scaleOrdinal(colorScheme);

export const colorScheme = [
    "#228CDB", // blue
    "#AF5D63", // brown
    "#7FB285", // green
    "#8e44ad", // purple
    "#2c3e50",  // dark blue
    "#ED6B86", // pink
    "#D36135" // orange
  ];
  
  export const colorScale = d3.scaleOrdinal(colorScheme);

export const getColor = (field) => {
    return COLORS[field];
}

export const generateColor = (index) => {
    const palette = ["#828080", "#4EA5D9", "#F6828C", "#57467B", "#70F8BA", "#6f80b1"];
    return palette[index % palette.length];
}

export const createColorScale = (scale) => {
    return d3.scaleDiverging(function(t) {
        return d3.interpolateRgbBasis([
            `#B5E8EB`, 
            `#A78D73`, 
            `#F45909`  
        ])(t);
    }).domain([scale.domain()[0], (scale.domain()[0] + scale.domain()[1]) / 2, scale.domain()[1]]);
};