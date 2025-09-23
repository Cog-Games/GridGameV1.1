import pandas as pd
import numpy as np
import glob
import os

# Load all xlsx files from data directory
data_files = glob.glob('data/experiment_data_*.xlsx')
print(f"Found {len(data_files)} experiment data files")

# Initialize list to store all questionnaire data
all_questionnaire_data = []

for file in data_files:
    try:
        # Read the questionnaire sheet
        df = pd.read_excel(file, sheet_name='Questionnaire Data')
        
        # Add file identifier
        df['file_id'] = os.path.basename(file)
        
        all_questionnaire_data.append(df)
        print(f"Loaded {file}: {len(df)} responses")
        
    except Exception as e:
        print(f"Error loading {file}: {e}")

# Combine all data
if all_questionnaire_data:
    questionnaire_df = pd.concat(all_questionnaire_data, ignore_index=True)
    print(f"\nTotal questionnaire responses: {len(questionnaire_df)}")
    
    # Save to CSV
    output_file = 'combined_questionnaire_data.csv'
    questionnaire_df.to_csv(output_file, index=False)
    print(f"Combined questionnaire data saved to: {output_file}")
    
    # Display basic info
    print(f"\nDataset shape: {questionnaire_df.shape}")
    print(f"Columns: {list(questionnaire_df.columns)}")
    
    # Show first few rows
    print("\nFirst few rows:")
    print(questionnaire_df.head())
else:
    print("No questionnaire data found")