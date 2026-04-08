import * as d3 from 'd3';

export const COLORS = {
    default: '#cececeff',
    select: '#F6828C',
    highlight: '#a4c8ddff'
}

export const colorScheme = d3.schemeDark2;
// export const colorScale = d3.scaleOrdinal(colorScheme);

const dark2 = d3.schemeDark2;

export const colorScale = (clusterId) => {
    const mapping = {
        0: dark2[0], // Teal
        1: dark2[1], // Orange
        2: dark2[2], // Purple
        3: dark2[3]  // Pink
    };
    return mapping[clusterId] || "#555555"; 
};