import  { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { SERVER_URL } from "../config";
import { useError } from "./ErrorContext";

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface UserContextType {
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const { showError } = useError();

  useEffect(() => {
    // Try to load user if already signed in (with cookies)
    const fetchUser = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/v1/me`, {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          console.log("Got user", data.data)
          setUser({
            id: data.data.id,
            name: data.data.Name,
            email: data.data.Email,
            picture: data.data.ProfileImage,
          })
        } else if (res.status === 401) {
          // Not authenticated
          setUser(null);
        } else {
          showError("Fetch user failed, status: " + res.status, await res.json());
        }
      } catch (e) {
        showError("Fetch user failed, err: " + e);
      }
    };
    fetchUser();
  }, [showError]);

  const signIn = async () => {
    window.location.href = `${SERVER_URL}/api/v1/users/signin`;
  };``

  const signOut = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </UserContext.Provider>
  );
};
