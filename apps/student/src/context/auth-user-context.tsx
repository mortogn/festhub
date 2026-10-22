"use client";

import client from "@/lib/api";
import { InferResponseType } from "hono";
import React, {
  createContext,
  useEffect,
  useState,
  PropsWithChildren,
  useContext,
} from "react";

type AuthUserContextType = InferResponseType<
  (typeof client)["users"]["self"]["$get"]
>;

export const AuthUserContext = createContext<AuthUserContextType | undefined>(
  undefined,
);

const fetchCurrentUser = async () => {
  const response = await client.users.self.$get();

  const data = await response.json();

  return data;
};

const AuthUserContextProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUserContextType | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const currUser = await fetchCurrentUser();

      setUser(currUser);
    })();
  }, []);

  return (
    <>
      <AuthUserContext.Provider value={user}>
        {children}
      </AuthUserContext.Provider>
      ;
    </>
  );
};

export const useAuthContext = () => {
  const authUser = useContext(AuthUserContext);

  return authUser;
};

export default AuthUserContextProvider;
