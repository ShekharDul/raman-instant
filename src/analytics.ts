const analyticsWindow = window as any;
analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
analyticsWindow.gtag = function() { analyticsWindow.dataLayer.push(arguments); };
analyticsWindow.gtag('js', new Date());
analyticsWindow.gtag('config', 'G-XR31BLTDQF');
export {};
