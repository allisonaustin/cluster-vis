import React, { useState, useEffect } from 'react';

const Dropdown = (params) => {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(params.selectedFile);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('http://localhost:5009/files')
                const fileList = await response.json();
                setFiles(fileList);
            } catch (error) {
                console.error('Error fetching files:', error)
            }
        };
        fetchFiles();
    }, []);

    const handleChange = (e) => {
        const newFile = e.target.value;
        setSelectedFile(newFile);
        params.onFileChange(newFile);
    };

    return (
        <div>
            <label htmlFor="Dropdown">Select file: </label>
            <select 
                id="dropdown"
                value={selectedFile}
                onChange={handleChange}
                >
                {files.map((file) => (
                    <option key={file} value={file}>
                        {file}
                    </option>
                ))}
            </select>
        </div>
    )
}

export default Dropdown;