// =================================================================================================
// NodeGame Experiments Helper Functions
// =================================================================================================
//
// This file contains utility functions and helpers for the NodeGame experiments.
// These functions are separated from the main experimental logic for better organization.
//
// =================================================================================================

// =================================================================================================
// EXPERIMENT SELECTION HELPER FUNCTIONS
// =================================================================================================

/**
 * Quick experiment selection functions - use these to easily switch between experiments
 * Call these functions before starting the experiment to change which experiments run
 */

/**
 * Set experiment to run only 1P1G
 */
function setExperiment1P1G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G'];
        console.log('Experiment set to 1P1G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 1P2G
 */
function setExperiment1P2G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P2G'];
        console.log('Experiment set to 1P2G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 2P2G
 */
function setExperiment2P2G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P2G'];
        console.log('Experiment set to 2P2G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run only 2P3G
 */
function setExperiment2P3G() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P3G'];
        console.log('Experiment set to 2P3G only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run all experiments in sequence
 */
function setExperimentAll() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G', '2P2G', '2P3G'];
        console.log('Experiment set to run all experiments');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run collaboration experiments only (2P2G and 2P3G)
 */
function setExperimentCollaboration() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['2P2G', '2P3G'];
        console.log('Experiment set to collaboration experiments only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set experiment to run single player experiments only (1P1G and 1P2G)
 */
function setExperimentSinglePlayer() {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = ['1P1G', '1P2G'];
        console.log('Experiment set to single player experiments only');
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

/**
 * Set custom experiment order
 * @param {Array} experimentOrder - Array of experiment types to run
 */
function setCustomExperimentOrder(experimentOrder) {
    if (typeof NODEGAME_CONFIG !== 'undefined') {
        NODEGAME_CONFIG.experimentOrder = experimentOrder;
        console.log('Experiment set to custom order:', experimentOrder);
    } else {
        console.error('NODEGAME_CONFIG not available');
    }
}

// =================================================================================================
// DATA EXPORT AND UTILITY FUNCTIONS
// =================================================================================================

/**
 * Convert experiment data to CSV format (matching jsPsych version)
 */
function convertToCSV(allTrialsData) {
    if (!allTrialsData || allTrialsData.length === 0) {
        return "trialIndex,message\n0,No experimental data available";
    }

    // Get all unique keys from all trials
    const allKeys = new Set();
    allTrialsData.forEach(trial => {
        if (trial && typeof trial === 'object') {
            Object.keys(trial).forEach(key => allKeys.add(key));
        }
    });

    // Convert Set to Array and sort for consistent order
    const headers = Array.from(allKeys).sort();

    // Create CSV header
    let csv = headers.join(',') + '\n';

    // Add data rows
    allTrialsData.forEach(trial => {
        if (trial && typeof trial === 'object') {
            const row = headers.map(header => {
                let value = trial[header];

                // Handle arrays and objects
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                } else if (value === null || value === undefined) {
                    value = '';
                } else {
                    value = String(value);
                }

                // Escape commas and quotes
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }

                return value;
            });
            csv += row.join(',') + '\n';
        }
    });

    return csv;
}

/**
 * Convert questionnaire data to array format (matching jsPsych version)
 */
function convertQuestionnaireToArray(questionnaireData) {
    if (!questionnaireData) {
        return [
            ['Question', 'Response'],
            ['No questionnaire data available', '']
        ];
    }

    // Define question mappings with multiple possible key formats
    const questionMappings = [
        {
            keys: ['ai_detection', 'Q0', 'q0', 'P0_Q0', 'p0_q0', '0'],
            question: 'Do you think the other player is a person or an AI agent?'
        },
        {
            keys: ['collaboration_rating', 'Q1', 'q1', 'P0_Q1', 'p0_q1', '1'],
            question: 'To what extent do you think the other player was a good collaborator?'
        },
        {
            keys: ['play_again', 'Q2', 'q2', 'P0_Q2', 'p0_q2', '2'],
            question: 'Will you play with them again?'
        },
        {
            keys: ['strategy', 'Q3', 'q3', 'P1_Q0', 'p1_q0', '3'],
            question: 'Did you use any strategy in the game? If yes, what was it?'
        },
        {
            keys: ['purpose', 'Q4', 'q4', 'P1_Q1', 'p1_q1', '4'],
            question: 'What do you think the purpose of this experiment is?'
        },
        {
            keys: ['comments', 'Q5', 'q5', 'P1_Q2', 'p1_q2', '5'],
            question: 'Do you have any questions or comments?'
        }
    ];

    const questionnaireArray = [['Question', 'Response']];

    // Add each question-response pair
    questionMappings.forEach((mapping, index) => {
        let response = '';

        // Try to find the response using different possible keys
        for (let key of mapping.keys) {
            if (questionnaireData[key] !== undefined && questionnaireData[key] !== null) {
                response = questionnaireData[key];
                break;
            }
        }

        // If still not found, try to find by index in an array-like structure
        if (response === '' && Array.isArray(questionnaireData)) {
            response = questionnaireData[index] || '';
        }

        // If still not found, check if questionnaireData has a response array
        if (response === '' && questionnaireData.response && Array.isArray(questionnaireData.response)) {
            response = questionnaireData.response[index] || '';
        }

        questionnaireArray.push([mapping.question, String(response)]);
    });

    return questionnaireArray;
}

/**
 * Function to download Excel file with multiple sheets (matching jsPsych version)
 */
function downloadExcel(experimentData, questionnaireData, filename) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found. Please include the SheetJS library.');
            alert('Excel export requires the SheetJS library. The file will be downloaded as CSV instead.');

            // Fallback to CSV
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            if (experimentData && experimentData.length > 0) {
                const experimentCSV = convertToCSV(experimentData);
                downloadCSV(experimentCSV, `experiment_data_${timestamp}.csv`);
            }
            if (questionnaireData && questionnaireData.length > 1) {
                const questionnaireCSV = questionnaireData.map(row => row.join(',')).join('\n');
                downloadCSV(questionnaireCSV, `questionnaire_data_${timestamp}.csv`);
            }
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Add experiment data sheet
        if (experimentData && experimentData.length > 0) {
            // Pre-process the data to handle complex objects and arrays
            const processedData = experimentData.map(trial => {
                const processedTrial = {};
                for (const key in trial) {
                    if (trial.hasOwnProperty(key)) {
                        let value = trial[key];
                        // Convert arrays and objects to JSON strings for Excel compatibility
                        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                            processedTrial[key] = JSON.stringify(value);
                        } else if (value === null || value === undefined) {
                            processedTrial[key] = ''; // Keep empty for null/undefined
                        } else {
                            processedTrial[key] = value;
                        }
                    }
                }
                return processedTrial;
            });

            const experimentWS = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(wb, experimentWS, "Experiment Data");
        } else {
            // Create empty sheet with message
            const emptyWS = XLSX.utils.aoa_to_sheet([["No experiment data available - only questionnaire was run"]]);
            XLSX.utils.book_append_sheet(wb, emptyWS, "Experiment Data");
        }

        // Add questionnaire data sheet
        if (questionnaireData && questionnaireData.length > 1) {
            const questionnaireWS = XLSX.utils.aoa_to_sheet(questionnaireData);
            XLSX.utils.book_append_sheet(wb, questionnaireWS, "Questionnaire Data");
        } else {
            // Create empty questionnaire sheet
            const emptyQuestionnaireWS = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
            XLSX.utils.book_append_sheet(wb, emptyQuestionnaireWS, "Questionnaire Data");
        }

        // Write the file
        XLSX.writeFile(wb, filename);

    } catch (error) {
        console.error('Error creating Excel file:', error);
        alert('Error creating Excel file. Please try again.');
    }
}

/**
 * Download CSV file (fallback)
 */
function downloadCSV(csvContent, filename) {
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Fallback for older browsers
            window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
        }
    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Error downloading CSV file. Please try again.');
    }
}

/**
 * Send Excel file to Google Drive (matching jsPsych version)
 */
function sendExcelToGoogleDrive(experimentData, questionnaireData, filename) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not found. Please include the SheetJS library.');
            alert('Excel export requires the SheetJS library. Please refresh the page and try again.');
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // Add experiment data sheet
        if (experimentData && experimentData.length > 0) {
            // Pre-process the data to handle complex objects and arrays
            const processedData = experimentData.map(trial => {
                const processedTrial = {};
                for (const key in trial) {
                    if (trial.hasOwnProperty(key)) {
                        let value = trial[key];
                        // Convert arrays and objects to JSON strings for Excel compatibility
                        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
                            processedTrial[key] = JSON.stringify(value);
                        } else if (value === null || value === undefined) {
                            processedTrial[key] = ''; // Keep empty for null/undefined
                        } else {
                            processedTrial[key] = value;
                        }
                    }
                }
                return processedTrial;
            });

            const experimentWS = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(wb, experimentWS, "Experiment Data");
        } else {
            // Create empty sheet with message
            const emptyWS = XLSX.utils.aoa_to_sheet([["No experiment data available - only questionnaire was run"]]);
            XLSX.utils.book_append_sheet(wb, emptyWS, "Experiment Data");
        }

        // Add questionnaire data sheet
        if (questionnaireData && questionnaireData.length > 1) {
            const questionnaireWS = XLSX.utils.aoa_to_sheet(questionnaireData);
            XLSX.utils.book_append_sheet(wb, questionnaireWS, "Questionnaire Data");
        } else {
            // Create empty questionnaire sheet
            const emptyQuestionnaireWS = XLSX.utils.aoa_to_sheet([["No questionnaire data available"]]);
            XLSX.utils.book_append_sheet(wb, emptyQuestionnaireWS, "Questionnaire Data");
        }

        // Convert workbook to binary array for sending to Google Drive
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // Convert to base64 string for transmission
        const base64String = btoa(String.fromCharCode.apply(null, new Uint8Array(wbout)));

        // Create FormData to send file
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('filedata', base64String);
        formData.append('filetype', 'excel');

        // Send to Google Drive via Apps Script
        fetch("https://script.google.com/macros/s/AKfycbyfQ-XKsoFbmQZGM7c741rEXh2ZUpVK-uUIu9ycooXKnaxM5-hRSzIUhQ-uWZ668Qql/exec", {
            method: "POST",
            mode: "no-cors",  // Required for Google Apps Script from local files
            body: formData
        }).then(response => {
            alert('Data saved successfully!');

            // Redirect to Prolific completion page
            redirectToProlific();

        }).catch(error => {
            console.error('Error saving to Google Drive:', error);
            alert('Error saving to Google Drive. Please try again.');
        });

    } catch (error) {
        console.error('Error creating Excel file for Google Drive:', error);
        alert('Error creating Excel file. Please try again.');
    }
}

/**
 * Save data to Google Drive (matching jsPsych version)
 */
function saveDataToGoogleDrive() {
    try {
        // Get experiment data from global gameData
        let experimentData = window.gameData ? window.gameData.allTrialsData : [];

        // If no experiment data, create a placeholder
        if (!experimentData || experimentData.length === 0) {
            experimentData = [{
                trialIndex: 0,
                note: 'No experimental data collected - experiment may not have been completed',
                timestamp: new Date().toISOString()
            }];
        }

        // Get questionnaire data from global gameData
        const questionnaireData = window.gameData ? window.gameData.questionnaireData : null;

        // Convert questionnaire data to array format
        const questionnaireArray = convertQuestionnaireToArray(questionnaireData);

        // Create Excel file to send to Google Drive
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const excelFilename = `experiment_data_${timestamp}.xlsx`;

        sendExcelToGoogleDrive(experimentData, questionnaireArray, excelFilename);

    } catch (error) {
        console.error('Error in saveDataToGoogleDrive:', error);
        alert('Error saving data to Google Drive. Please try again.');
    }
}

/**
 * Export experiment data with questionnaire (matching jsPsych version)
 */
function exportExperimentData() {
    if (!window.gameData) {
        console.error('Game data not available');
        return;
    }

    var finalData = {
        experimentData: window.gameData.allTrialsData,
        questionnaireData: window.gameData.questionnaireData,
        metadata: {
            experiment: window.gameData.currentExperiment,
            timestamp: new Date().toISOString(),
            totalTrials: window.gameData.allTrialsData.length,
            successRate: calculateSuccessRate()
        }
    };

    try {
        // Export experiment data
        var csvContent = convertToCSV(finalData.experimentData);
        downloadCSV(csvContent, `nodegame_experiment_${window.gameData.currentExperiment}_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);

        // Export questionnaire data if available
        if (window.gameData.questionnaireData) {
            var questionnaireArray = convertQuestionnaireToArray(window.gameData.questionnaireData);
            var questionnaireCSV = questionnaireArray.map(row => row.join(',')).join('\n');
            downloadCSV(questionnaireCSV, `questionnaire_data_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.csv`);
        }

        console.log('Experiment and questionnaire data exported successfully');
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data: ' + error.message);
    }
}

/**
 * Calculate success rate for stats
 */
function calculateSuccessRate() {
    if (!window.gameData || !window.gameData.allTrialsData || window.gameData.allTrialsData.length === 0) return 0;

    var successful = window.gameData.allTrialsData.filter(trial =>
        trial.collaborationSucceeded === true || trial.completed === true
    ).length;

    return Math.round((successful / window.gameData.allTrialsData.length) * 100);
}

/**
 * Redirect to Prolific completion page (matching jsPsych version)
 */
function redirectToProlific() {
    if (typeof NODEGAME_CONFIG !== 'undefined' && NODEGAME_CONFIG.enableProlificRedirect) {
        window.location.href = `https://app.prolific.com/submissions/complete?cc=${NODEGAME_CONFIG.prolificCompletionCode}`;
    } else {
        console.log('Prolific redirect disabled for testing');
        // For testing, just proceed to completion stage
        if (typeof nextStage === 'function') {
            nextStage();
        }
    }
}

// =================================================================================================
// GLOBAL EXPORTS
// =================================================================================================

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Experiment selection helpers
        setExperiment1P1G,
        setExperiment1P2G,
        setExperiment2P2G,
        setExperiment2P3G,
        setExperimentAll,
        setExperimentCollaboration,
        setExperimentSinglePlayer,
        setCustomExperimentOrder,

        // Data export functions
        saveDataToGoogleDrive,
        exportExperimentData,
        sendExcelToGoogleDrive,
        downloadExcel,
        downloadCSV,
        convertToCSV,
        convertQuestionnaireToArray,
        calculateSuccessRate,
        redirectToProlific
    };
}

// Global functions for easy access
window.NodeGameHelpers = {
    // Experiment selection helpers
    setExperiment1P1G,
    setExperiment1P2G,
    setExperiment2P2G,
    setExperiment2P3G,
    setExperimentAll,
    setExperimentCollaboration,
    setExperimentSinglePlayer,
    setCustomExperimentOrder,

    // Data saving functions
    saveDataToGoogleDrive,
    exportExperimentData,
    sendExcelToGoogleDrive,
    downloadExcel,
    downloadCSV,
    convertToCSV,
    convertQuestionnaireToArray,
    calculateSuccessRate,
    redirectToProlific
};