import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the context type
interface ActivityContextType {
    activity: string;
    setActivity: (activity: string) => void;
}

// Create the context
const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

// Create a provider component
export const ActivityProvider = ({ children }: { children: ReactNode }) => {
    const [activity, setActivity] = useState<string>('walking');

    return (
        <ActivityContext.Provider value={{ activity, setActivity }}>
            {children}
        </ActivityContext.Provider>
    );
};

// Create a custom hook for easier use of the context
export const useActivity = (): ActivityContextType => {
    const context = useContext(ActivityContext);
    if (!context) {
        throw new Error('useActivity must be used within an ActivityProvider');
    }
    return context;
};
