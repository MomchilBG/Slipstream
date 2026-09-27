export const formatFullName = (firstName: string, lastName: string | null): string => (lastName ? `${firstName} ${lastName}` : firstName)
