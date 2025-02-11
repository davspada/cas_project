import { createContext, useContext, useState } from 'react';

const AlertContext = createContext<any>(null);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
    const [alerts, setAlerts] = useState<any[]>([]);

    return (
        <AlertContext.Provider value={{ alerts, setAlerts }}>
            {children}
        </AlertContext.Provider>
    );
};

export const useAlert = () => useContext(AlertContext);
