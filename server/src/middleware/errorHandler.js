export const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  // Return consistent error envelope as per Technical Design Document
  return res.status(status).json({
    error: message,
    ...(err.fields ? { fields: err.fields } : {})
  });
};
