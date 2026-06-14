import re

with open('src/components/admin/settings/SettingsTab.tsx', 'r') as f:
    content = f.read()

# Add useEffect import if not there
if 'useEffect' not in content:
    content = content.replace("import React, { useState }", "import React, { useState, useEffect }")

# Insert useEffect body
use_effect = """
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/bulk?keys=pagarme_soft_descriptor,pagarme_soft_descriptor_bernoulli,terms_template,entrega_casa_habilitada,entrega_casa_preco');
        const data = await res.json();
        if (data.pagarme_soft_descriptor) setPagarmeSoftDescriptor(data.pagarme_soft_descriptor);
        if (data.pagarme_soft_descriptor_bernoulli) setPagarmeSoftDescriptorBernoulli(data.pagarme_soft_descriptor_bernoulli);
        if (data.terms_template) setTermsTemplate(data.terms_template);
        if (data.entrega_casa_habilitada) setEntregaCasaHabilitada(data.entrega_casa_habilitada === 'true');
        if (data.entrega_casa_preco) setEntregaCasaPreco(Number(data.entrega_casa_preco) || 0);

        const wRes = await fetch('/api/admin/website-configs');
        if (wRes.ok) {
          const wData = await wRes.json();
          setWebsiteConfigs(wData || {});
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);
"""

content = content.replace("const saveSoftDescriptors = async () => {};", use_effect + "\n  const saveSoftDescriptors = async () => {\n    setIsSavingPagarme(true);\n    try {\n      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'pagarme_soft_descriptor', value: pagarmeSoftDescriptor }) });\n      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'pagarme_soft_descriptor_bernoulli', value: pagarmeSoftDescriptorBernoulli }) });\n      toast.success('Soft Descriptors salvos!');\n    } catch (e) { toast.error('Erro ao salvar'); }\n    setIsSavingPagarme(false);\n  };")

content = content.replace("const saveTermsOfUse = async () => {};", "const saveTermsOfUse = async () => {\n    setIsSavingTerms(true);\n    try {\n      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'terms_template', value: termsTemplate }) });\n      toast.success('Termos salvos!');\n    } catch (e) { toast.error('Erro ao salvar'); }\n    setIsSavingTerms(false);\n  };")

content = content.replace("const handleWebsiteConfigChange = (field: string, value: any) => {};", "const handleWebsiteConfigChange = (field: string, value: any) => { setWebsiteConfigs({ ...websiteConfigs, [field]: value }); };")

content = content.replace("const saveWebsiteConfigs = async () => {};", "const saveWebsiteConfigs = async () => {\n    setIsSavingWebsite(true);\n    try {\n      await fetch('/api/admin/website-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(websiteConfigs) });\n      toast.success('Website atualizado!');\n    } catch (e) { toast.error('Erro ao atualizar website'); }\n    setIsSavingWebsite(false);\n  };")

content = content.replace("const handleSaveFrete = async () => {};", "const handleSaveFrete = async () => {\n    setIsSavingFrete(true);\n    try {\n      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'entrega_casa_habilitada', value: entregaCasaHabilitada ? 'true' : 'false' }) });\n      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'entrega_casa_preco', value: entregaCasaPreco.toString() }) });\n      toast.success('Frete salvo!');\n    } catch (e) { toast.error('Erro ao salvar'); }\n    setIsSavingFrete(false);\n  };")

with open('src/components/admin/settings/SettingsTab.tsx', 'w') as f:
    f.write(content)

print('SettingsTab logic fixed.')
