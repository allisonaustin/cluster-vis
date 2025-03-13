import * as d3 from 'd3';

export const COLORS = {
    default: '#6f80b1',
    select: '#F6828C',
    highlight: '#4EA5D9'
}

export const colorScheme = d3.schemeObservable10;
export const colorScale = d3.scaleOrdinal(colorScheme);

export const getColor = (field) => {
    return COLORS[field];
}

export const generateColor = (index) => {
    const palette = ["#6f80b1", "#F6828C", "#4EA5D9", "#57467B", "#70F8BA"];
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