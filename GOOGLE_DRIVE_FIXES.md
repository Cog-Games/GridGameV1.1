# Google Drive Saving Fixes

## Issue Description

The human-AI version of the experiment was showing the error "Error saving data to Google Drive. Please try again." when trying to save experiment data at the end of the experiment.

## Root Cause Analysis

Several issues were identified:

1. **Duplicate function definition**: There were two `sendExcelToGoogleDrive` functions defined in `expTimeline.js`
2. **Missing functions**: The `redirectToProlific` and `convertQuestionnaireToArray` functions were called but not defined
3. **No fallback mechanism**: When Google Drive saving failed, there was no alternative way to save the data
4. **Missing global exports**: Some functions weren't available globally for other scripts to use

## Fixes Applied

### 1. Removed Duplicate Function Definition

**Problem**: Two `sendExcelToGoogleDrive` functions were defined in `expTimeline.js`, causing confusion and potential conflicts.

**Fix**: Removed the duplicate function and kept only one properly implemented version.

### 2. Added Missing Functions

**Problem**: Several functions were called but not defined:
- `redirectToProlific()` - for redirecting to Prolific completion page
- `convertQuestionnaireToArray()` - for converting questionnaire data to Excel format
- `exportExperimentData()` - for exporting data as JSON

**Fix**: Implemented all missing functions with proper error handling.

### 3. Implemented Fallback Mechanism

**Problem**: When Google Drive saving failed, users had no way to save their data.

**Fix**: Added comprehensive fallback mechanisms:
- **Local Excel download**: If Google Drive fails, automatically download Excel file locally
- **JSON export**: Alternative data export format
- **Error recovery**: Graceful handling of various error conditions

### 4. Enhanced Error Handling

**Problem**: Limited error handling and user feedback.

**Fix**: Added comprehensive error handling:
- Detailed console logging for debugging
- User-friendly error messages
- Multiple fallback options
- Automatic recovery from common errors

## New Functions Added

### `convertQuestionnaireToArray(questionnaireData)`
Converts questionnaire data to array format suitable for Excel export.

### `downloadExcelFileLocally(wb, filename)`
Downloads Excel file locally when Google Drive saving fails.

### `redirectToProlific()`
Handles redirection to Prolific completion page with local testing support.

### `exportExperimentData()`
Exports experiment data as JSON file for backup purposes.

## How the Fix Works

1. **Primary Path**: Try to save to Google Drive via Apps Script
2. **Fallback Path 1**: If Google Drive fails, automatically download Excel file locally
3. **Fallback Path 2**: If Excel creation fails, show error message and redirect
4. **Local Testing**: When running locally (localhost), skip Prolific redirect and show completion page

## Testing

A test file `test_google_drive_fix.html` has been created to verify the fixes:

- **Test Google Drive Save**: Tests the main saving functionality
- **Test Local Download**: Tests the fallback download mechanism
- **Test Error Handling**: Tests error recovery scenarios

## Expected Behavior After Fix

1. **Successful Google Drive Save**: Data is saved to Google Drive and user is redirected to Prolific
2. **Failed Google Drive Save**: Data is automatically downloaded locally, then user is redirected
3. **Local Testing**: No Google Drive attempt, direct download and completion page
4. **Error Recovery**: Graceful handling of all error conditions with user feedback

## Files Modified

1. `public/js/expTimeline.js` - Main fixes and new functions
2. `public/test_google_drive_fix.html` - Test file (new)
3. `GOOGLE_DRIVE_FIXES.md` - This documentation (new)

## Usage

The fixes are automatically applied when using the human-AI version. Users will now have multiple ways to save their data:

1. **Automatic Google Drive save** (primary)
2. **Automatic local Excel download** (fallback)
3. **Manual JSON export** (via completion page button)

## Troubleshooting

If issues persist:

1. Check browser console for detailed error messages
2. Verify XLSX library is loaded (should be automatic)
3. Test with the provided test file
4. Check network connectivity for Google Drive access
5. Verify Google Apps Script URL is valid and accessible

## Future Improvements

Consider implementing:
- Server-side data saving as additional fallback
- Real-time data streaming during experiment
- Automatic retry mechanism for failed saves
- Data compression for large datasets