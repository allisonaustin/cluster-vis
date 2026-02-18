import * as d3 from 'd3';

export const COLORS = {
    default: '#cececeff',
    select: '#F6828C',
    highlight: '#a4c8ddff'
}

export const colorScheme = d3.schemeSet2;
export const colorScale = d3.scaleOrdinal(colorScheme);