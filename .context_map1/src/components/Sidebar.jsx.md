**Purpose:**

Vertical left sidebar that shows the available services. Calls selectService function to change the current service when user clicks.

**Code structure:**

*Imports*

*Sidebar component*

```js
const Sidebar = () => {
  const { currentService, selectService } = useApp();

  return (
    <aside className="sidebar">
      <nav className="nav-services">
        {SERVICE_ORDER.map((id) => {
          const service = SERVICES[id];
          if (service.disabled) return null;

          return (
            <button
              key={id}
              className={`nav-item ${currentService.id === id ? 'active' : ''}`}
              onClick={() => selectService(id)}
            >
              <span className="icon">{service.icon}</span>
              <span className="label">{service.name}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  );
};
```

