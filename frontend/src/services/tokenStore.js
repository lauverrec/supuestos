let tokenGetter = null;

export const setTokenGetter = (getter) => {
  tokenGetter = getter;
};

export const getAuthToken = async () => {
  if (tokenGetter) {
    return await tokenGetter();
  }
  return null;
};