# RECLAIM - Addiction Recovery Support Platform

Production-quality frontend for a comprehensive addiction recovery support system combining personalized plans, daily task management, AI coaching, emotional tracking, and crisis support.

## 🧪 Testing

No tests included in this build. To add tests:

```bash
# Install Jest and React Testing Library
pnpm add -D jest @testing-library/react @testing-library/jest-dom

# Create __tests__ directory and add test files
# Run tests with: pnpm test
```

## ðŸ“¦ Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

Set environment variable in Vercel dashboard:
- `NEXT_PUBLIC_API_BASE`: Your production API URL

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## ðŸ› Troubleshooting

### "API is not responding"
- Ensure backend is running on the correct port
- Check `NEXT_PUBLIC_API_BASE` environment variable
- Verify CORS is enabled on backend

### "localStorage is undefined"
- This error should not occur in production
- Ensure code runs on client side (use "use client" directive)

### "Encryption failed"
- Browser must support Web Crypto API (all modern browsers)
- Check browser console for specific crypto errors

## ðŸ“ Development Notes

- All state is client-side (React hooks)
- No database queries on frontend
- API responses determine UI state
- Error messages are user-friendly
- Loading states prevent duplicate submissions

## ðŸ¤ Contributing

Internal development. Contact the team for guidelines.

## ðŸ“ž Support

For issues, contact the development team or visit https://vercel.com/help

