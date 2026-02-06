import { useState, useEffect, useCallback } from "react";
import { containerMappings } from "@/lib/storage";
import { getAllProviders } from "@/lib/providers";
import type { ContainerMapping, ServiceMapping } from "@/lib/types";
import type { ContextualIdentity, ContextualIdentitiesAPI } from "@/lib/firefox";
import "./App.css";

function App() {
  const [containers, setContainers] = useState<ContextualIdentity[]>([]);
  const [mappings, setMappings] = useState<ContainerMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const contextualIdentities = (browser as unknown as { contextualIdentities?: ContextualIdentitiesAPI }).contextualIdentities;
      if (!contextualIdentities) {
        setError(
          "Multi-Account Containers is not available. " +
          "Please install the Firefox Multi-Account Containers extension."
        );
        return;
      }
      try {
        const ctxList = await contextualIdentities.query({});
        const allContainers: ContextualIdentity[] = [
          {
            cookieStoreId: "firefox-default",
            name: "Default",
            color: "#999",
            icon: "",
            colorCode: "#999",
            iconUrl: "",
          },
          ...ctxList,
        ];
        setContainers(allContainers);

        const stored = await containerMappings.getValue();
        const validIds = new Set(allContainers.map((c) => c.cookieStoreId));
        const pruned = stored.filter((m) => validIds.has(m.cookieStoreId));
        if (pruned.length !== stored.length) {
          await containerMappings.setValue(pruned);
        }
        setMappings(pruned);
      } catch {
        setError("Failed to load containers. Is Multi-Account Containers enabled?");
      }
    })();
  }, []);

  const saveMappings = useCallback(async (updated: ContainerMapping[]) => {
    setMappings(updated);
    await containerMappings.setValue(updated);
  }, []);

  const addService = (cookieStoreId: string, serviceId: string) => {
    const updated = [...mappings];
    let mapping = updated.find((m) => m.cookieStoreId === cookieStoreId);
    if (!mapping) {
      mapping = { cookieStoreId, services: [] };
      updated.push(mapping);
    }
    if (!mapping.services.find((s) => s.serviceId === serviceId)) {
      mapping.services.push({ serviceId, accountIds: [] });
    }
    saveMappings(updated);
  };

  const removeService = (cookieStoreId: string, serviceId: string) => {
    const updated = mappings.map((m) => {
      if (m.cookieStoreId !== cookieStoreId) return m;
      return { ...m, services: m.services.filter((s) => s.serviceId !== serviceId) };
    }).filter((m) => m.services.length > 0);
    saveMappings(updated);
  };

  const addAccount = (cookieStoreId: string, serviceId: string, accountId: string) => {
    const updated = mappings.map((m) => {
      if (m.cookieStoreId !== cookieStoreId) return m;
      return {
        ...m,
        services: m.services.map((s) => {
          if (s.serviceId !== serviceId) return s;
          if (s.accountIds.includes(accountId)) return s;
          return { ...s, accountIds: [...s.accountIds, accountId] };
        }),
      };
    });
    saveMappings(updated);
  };

  const removeAccount = (cookieStoreId: string, serviceId: string, accountId: string) => {
    const updated = mappings.map((m) => {
      if (m.cookieStoreId !== cookieStoreId) return m;
      return {
        ...m,
        services: m.services.map((s) => {
          if (s.serviceId !== serviceId) return s;
          return { ...s, accountIds: s.accountIds.filter((a) => a !== accountId) };
        }),
      };
    });
    saveMappings(updated);
  };

  if (error) return <div className="error">{error}</div>;

  return (
    <div className="popup">
      <h1>Account Identifier</h1>
      {containers.map((container) => (
        <ContainerSection
          key={container.cookieStoreId}
          container={container}
          mapping={mappings.find((m) => m.cookieStoreId === container.cookieStoreId)}
          onAddService={(serviceId) => addService(container.cookieStoreId, serviceId)}
          onRemoveService={(serviceId) => removeService(container.cookieStoreId, serviceId)}
          onAddAccount={(serviceId, accountId) =>
            addAccount(container.cookieStoreId, serviceId, accountId)
          }
          onRemoveAccount={(serviceId, accountId) =>
            removeAccount(container.cookieStoreId, serviceId, accountId)
          }
        />
      ))}
    </div>
  );
}

function ContainerSection({ container, mapping, onAddService, onRemoveService, onAddAccount, onRemoveAccount }: {
  container: ContextualIdentity;
  mapping: ContainerMapping | undefined;
  onAddService: (serviceId: string) => void;
  onRemoveService: (serviceId: string) => void;
  onAddAccount: (serviceId: string, accountId: string) => void;
  onRemoveAccount: (serviceId: string, accountId: string) => void;
}) {
  const providers = getAllProviders();
  const existingServiceIds = mapping?.services.map((s) => s.serviceId) ?? [];
  const availableProviders = providers.filter((p) => !existingServiceIds.includes(p.id));

  return (
    <section className="container-section">
      <h2>
        <span className="color-dot" style={{ backgroundColor: container.color }} />
        {container.name}
      </h2>
      {mapping?.services.map((service) => {
        const provider = providers.find((p) => p.id === service.serviceId);
        return (
          <ServiceSection
            key={service.serviceId}
            displayName={provider?.displayName ?? service.serviceId}
            service={service}
            onRemoveService={() => onRemoveService(service.serviceId)}
            onAddAccount={(accountId) => onAddAccount(service.serviceId, accountId)}
            onRemoveAccount={(accountId) => onRemoveAccount(service.serviceId, accountId)}
          />
        );
      })}
      {availableProviders.length > 0 && (
        <button
          className="add-service-btn"
          onClick={() => onAddService(availableProviders[0].id)}
        >
          + Add {availableProviders[0].displayName}
        </button>
      )}
    </section>
  );
}

function ServiceSection({ displayName, service, onRemoveService, onAddAccount, onRemoveAccount }: {
  displayName: string;
  service: ServiceMapping;
  onRemoveService: () => void;
  onAddAccount: (accountId: string) => void;
  onRemoveAccount: (accountId: string) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onAddAccount(trimmed);
    setInputValue("");
  };

  return (
    <div className="service-section">
      <div className="service-header">
        <span>{displayName}</span>
        <button onClick={onRemoveService} className="remove-btn" title="Remove service">x</button>
      </div>
      <ul className="account-list">
        {service.accountIds.map((accountId) => (
          <li key={accountId}>
            {accountId}
            <button onClick={() => onRemoveAccount(accountId)} className="remove-btn" title="Remove account">x</button>
          </li>
        ))}
      </ul>
      <div className="add-account">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Account ID"
        />
        <button onClick={handleAdd}>Add</button>
      </div>
    </div>
  );
}

export default App;
