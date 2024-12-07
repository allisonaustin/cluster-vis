export const COLORS = {
    default: '#2A4494'
}

export const getColor = (field) => {
    return COLORS[field];
}

export const generateColor = (index) => {
    const palette = ["#69b3a2", "#4EA5D9", "#57467B", "#70F8BA", "#F6828C"];
    return palette[index % palette.length];
}