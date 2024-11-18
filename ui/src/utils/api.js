const FLASK_URL = "http://127.0.0.1:5008";

export async function fetchData(dir, filename, inc) {
    try {
        const response = await fetch(`${FLASK_URL}/getData/${dir}/${filename}/${inc}`);
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
}