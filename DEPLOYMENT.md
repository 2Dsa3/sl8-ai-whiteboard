# SL8.ai - Production Deployment Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Development:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## Deployment Options

### 1. Netlify (Recommended)
- Connect your GitHub repository to Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Auto-deploys on push to main branch

### 2. Vercel
- Connect your GitHub repository to Vercel
- Build command: `npm run build`
- Output directory: `dist`
- Auto-deploys on push

### 3. GitHub Pages
- Build the project: `npm run build`
- Deploy the `dist` folder to GitHub Pages
- Use GitHub Actions for automatic deployment

### 4. Traditional Web Hosting
- Build the project: `npm run build`
- Upload the contents of the `dist` folder to your web server
- Ensure your server serves `index.html` for all routes

## Environment Variables

For production deployment, you may want to set up environment variables:

1. Create `.env.production` file (not committed to git)
2. Add your API keys and configuration
3. Update the code to use `import.meta.env.VITE_API_KEY`

## Performance Optimizations

The Vite build automatically includes:
- Code splitting
- Tree shaking
- Minification
- Asset optimization
- Modern JavaScript output

## Browser Support

- Modern browsers (ES2015+)
- Chrome 63+
- Firefox 67+
- Safari 11.1+
- Edge 79+
