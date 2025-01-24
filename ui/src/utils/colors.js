import * as d3 from 'd3';

export const COLORS = {
    default: '#6f80b1'
}

export const getColor = (field) => {
    return COLORS[field];
}

export const generateColor = (index) => {
    const palette = ["#69b3a2", "#4EA5D9", "#57467B", "#70F8BA", "#F6828C"];
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