package com.infinity.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.kie.api.runtime.KieContainer;
import org.kie.api.runtime.KieSession;
import org.kie.api.runtime.KieRuntimeFactory;
import org.kie.dmn.api.core.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/decision")
@CrossOrigin(origins = "*") // Allow React UI to call this
public class DecisionController {

    private static final Logger logger = LoggerFactory.getLogger(DecisionController.class);

    @Autowired
    private KieContainer kieContainer;

    @PostMapping("/evaluate")
    public Map<String, Object> evaluate(@RequestBody Map<String, Object> input) {
        KieSession ksession = kieContainer.newKieSession();
        try {
            DMNRuntime dmnRuntime = KieRuntimeFactory.of(ksession.getKieBase()).get(DMNRuntime.class);

            // Try to locate a useful DMN model. The project contains Quickwin.dmn with
            // name="quickwins" and namespace="dmnRules" so prefer that. If not found,
            // log available models and fall back to the first one.
            List<DMNModel> models = dmnRuntime.getModels();
            if (models == null || models.isEmpty()) {
                logger.error("No DMN models available on the DMN runtime");
                throw new RuntimeException("No DMN models available");
            }

            // Prefer model with name "quickwins" or namespace "dmnRules"
            DMNModel dmnModel = null;
            for (DMNModel m : models) {
                String name = m.getName();
                String ns = m.getNamespace();
                logger.info("Found DMN model: name='{}' namespace='{}'", name, ns);
                if ("quickwins".equalsIgnoreCase(name) || "dmnRules".equalsIgnoreCase(ns)) {
                    dmnModel = m;
                    break;
                }
            }

            // Fallback: use first model
            if (dmnModel == null) {
                dmnModel = models.get(0);
                logger.warn("Using fallback DMN model: name='{}' namespace='{}'", dmnModel.getName(), dmnModel.getNamespace());
            }

            DMNContext context = dmnRuntime.newContext();
            input.forEach(context::set);

            DMNResult dmnResult = dmnRuntime.evaluateAll(dmnModel, context);

            Map<String, Object> result = new HashMap<>();
            dmnResult.getDecisionResults().forEach(d -> result.put(d.getDecisionName(), d.getResult()));

            return result;
        } finally {
            // Always dispose the session to avoid leaking resources
            try {
                ksession.dispose();
            } catch (Exception e) {
                logger.debug("Error disposing KieSession: {}", e.getMessage());
            }
        }
    }

    @GetMapping("/models")
    public List<Map<String, Object>> listModels() {
        try {
            // Use Spring resource resolver to find DMN files on the classpath
            org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
            org.springframework.core.io.Resource[] resources = resolver.getResources("classpath*:**/*.dmn");
            List<Map<String, Object>> out = new ArrayList<>();
            // track seen models to avoid duplicates (same name+namespace)
            java.util.Set<String> seen = new java.util.HashSet<>();
            for (org.springframework.core.io.Resource r : resources) {
                try (java.io.InputStream is = r.getInputStream()) {
                    javax.xml.parsers.DocumentBuilderFactory dbFactory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    dbFactory.setNamespaceAware(true);
                    javax.xml.parsers.DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
                    org.w3c.dom.Document doc = dBuilder.parse(is);
                    org.w3c.dom.Element defs = doc.getDocumentElement();
                    String name = defs.getAttribute("name");
                    String ns = defs.getAttribute("namespace");

                    Map<String, Object> mi = new HashMap<>();
                    mi.put("name", name);
                    mi.put("namespace", ns);

                    List<Map<String, String>> inputs = new ArrayList<>();
                    org.w3c.dom.NodeList inputDataNodes = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "inputData");
                    for (int i = 0; i < inputDataNodes.getLength(); i++) {
                        org.w3c.dom.Element in = (org.w3c.dom.Element) inputDataNodes.item(i);
                        String inName = in.getAttribute("name");
                        // variable type is inside <variable name=... typeRef=... />
                        org.w3c.dom.NodeList varNodes = in.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "variable");
                        String typeRef = "";
                        if (varNodes.getLength() > 0) {
                            org.w3c.dom.Element var = (org.w3c.dom.Element) varNodes.item(0);
                            typeRef = var.getAttribute("typeRef");
                        }
                        Map<String, String> iv = new HashMap<>();
                        iv.put("name", inName);
                        iv.put("type", typeRef);
                        inputs.add(iv);
                    }

                    mi.put("inputs", inputs);
                    String key = (name == null ? "" : name) + "::" + (ns == null ? "" : ns);
                    if (seen.contains(key)) {
                        // skip duplicate model definitions found on the classpath
                        continue;
                    }
                    seen.add(key);
                    out.add(mi);
                } catch (Exception e) {
                    logger.warn("Failed to read DMN resource {}: {}", r.getFilename(), e.getMessage());
                }
            }
            return out;
        } catch (Exception e) {
            logger.error("Error listing DMN models: {}", e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    @GetMapping("/models/{modelName}/schema")
    public Map<String, Object> getModelSchema(@PathVariable("modelName") String modelName) {
        try {
            org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
            org.springframework.core.io.Resource[] resources = resolver.getResources("classpath*:**/*.dmn");

            for (org.springframework.core.io.Resource r : resources) {
                try (java.io.InputStream is = r.getInputStream()) {
                    javax.xml.parsers.DocumentBuilderFactory dbFactory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    dbFactory.setNamespaceAware(true);
                    javax.xml.parsers.DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
                    org.w3c.dom.Document doc = dBuilder.parse(is);
                    org.w3c.dom.Element defs = doc.getDocumentElement();
                    String name = defs.getAttribute("name");
                    if (name == null) name = "";
                    if (!name.equalsIgnoreCase(modelName)) continue;

                    // collect itemDefinition elements by name
                    Map<String, org.w3c.dom.Element> itemDefs = new HashMap<>();
                    org.w3c.dom.NodeList itemDefNodes = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "itemDefinition");
                    for (int i = 0; i < itemDefNodes.getLength(); i++) {
                        org.w3c.dom.Element idEl = (org.w3c.dom.Element) itemDefNodes.item(i);
                        String idName = idEl.getAttribute("name");
                        if (idName != null && !idName.isEmpty()) {
                            itemDefs.put(idName, idEl);
                        }
                    }

                    // function to resolve a typeRef into a schema map
                    java.util.function.Function<String, Object> resolveType = new java.util.function.Function<String, Object>() {
                        @Override
                        public Object apply(String typeRef) {
                            if (typeRef == null || typeRef.isEmpty()) return Collections.singletonMap("type", "string");
                            // if typeRef matches an itemDefinition name, expand
                            if (itemDefs.containsKey(typeRef)) {
                                org.w3c.dom.Element td = itemDefs.get(typeRef);
                                Map<String, Object> out = new HashMap<>();
                                out.put("type", typeRef);
                                List<Map<String, Object>> fields = new ArrayList<>();
                                org.w3c.dom.NodeList comps = td.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "itemComponent");
                                for (int j = 0; j < comps.getLength(); j++) {
                                    org.w3c.dom.Element comp = (org.w3c.dom.Element) comps.item(j);
                                    String fname = comp.getAttribute("name");
                                    String isCollection = comp.getAttribute("isCollection");
                                    String ftype = "";
                                    org.w3c.dom.NodeList tref = comp.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "typeRef");
                                    if (tref != null && tref.getLength() > 0) {
                                        org.w3c.dom.Element trefEl = (org.w3c.dom.Element) tref.item(0);
                                        ftype = trefEl.getTextContent();
                                    }
                                    Map<String, Object> f = new HashMap<>();
                                    f.put("name", fname);
                                    f.put("isCollection", "true".equalsIgnoreCase(isCollection));
                                    if (ftype != null && !ftype.isEmpty() && itemDefs.containsKey(ftype)) {
                                        // nested complex type
                                        f.put("type", ftype);
                                        f.put("schema", this.apply(ftype));
                                    } else {
                                        f.put("type", (ftype == null || ftype.isEmpty()) ? "string" : ftype);
                                    }
                                    fields.add(f);
                                }
                                out.put("fields", fields);
                                return out;
                            } else {
                                // primitive type
                                Map<String, Object> prim = new HashMap<>();
                                prim.put("type", typeRef);
                                return prim;
                            }
                        }
                    };

                    // find model inputs
                    List<Map<String, Object>> inputs = new ArrayList<>();
                    org.w3c.dom.NodeList inputDataNodes = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "inputData");
                    for (int i = 0; i < inputDataNodes.getLength(); i++) {
                        org.w3c.dom.Element in = (org.w3c.dom.Element) inputDataNodes.item(i);
                        String inName = in.getAttribute("name");
                        String typeRef = "";
                        org.w3c.dom.NodeList varNodes = in.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "variable");
                        if (varNodes.getLength() > 0) {
                            org.w3c.dom.Element var = (org.w3c.dom.Element) varNodes.item(0);
                            typeRef = var.getAttribute("typeRef");
                        }
                        Map<String, Object> im = new HashMap<>();
                        im.put("name", inName);
                        im.put("type", typeRef);
                        // attach expanded schema if available
                        Object expanded = resolveType.apply(typeRef);
                        im.put("schema", expanded);
                        inputs.add(im);
                    }

                    Map<String, Object> out = new HashMap<>();
                    out.put("name", name);
                    out.put("namespace", defs.getAttribute("namespace"));
                    out.put("inputs", inputs);
                    return out;
                } catch (Exception e) {
                    logger.warn("Failed to read DMN resource {}: {}", r.getFilename(), e.getMessage());
                }
            }
            throw new RuntimeException("Model not found: " + modelName);
        } catch (Exception e) {
            logger.error("Error building schema for model {}: {}", modelName, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    // --- Decision table endpoints ---
    @GetMapping("/models/{modelName}/tables")
    public List<Map<String, Object>> listDecisionTables(@PathVariable("modelName") String modelName) {
        try {
            org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
            org.springframework.core.io.Resource[] resources = resolver.getResources("classpath*:**/*.dmn");
            for (org.springframework.core.io.Resource r : resources) {
                try (java.io.InputStream is = r.getInputStream()) {
                    javax.xml.parsers.DocumentBuilderFactory dbFactory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    dbFactory.setNamespaceAware(true);
                    javax.xml.parsers.DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
                    org.w3c.dom.Document doc = dBuilder.parse(is);
                    org.w3c.dom.Element defs = doc.getDocumentElement();
                    String name = defs.getAttribute("name");
                    if (name == null) name = "";
                    if (!name.equalsIgnoreCase(modelName)) continue;

                    List<Map<String, Object>> out = new ArrayList<>();
                    org.w3c.dom.NodeList decs = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decision");
                    for (int i = 0; i < decs.getLength(); i++) {
                        org.w3c.dom.Element dec = (org.w3c.dom.Element) decs.item(i);
                        String dname = dec.getAttribute("name");
                        boolean hasTable = dec.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decisionTable").getLength() > 0;
                        Map<String, Object> m = new HashMap<>();
                        m.put("name", dname);
                        m.put("hasDecisionTable", hasTable);
                        out.add(m);
                    }
                    return out;
                } catch (Exception e) {
                    logger.warn("Failed reading DMN resource for tables {}: {}", r.getFilename(), e.getMessage());
                }
            }
            throw new RuntimeException("Model not found: " + modelName);
        } catch (Exception e) {
            logger.error("Error listing decision tables for model {}: {}", modelName, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    @GetMapping("/models/{modelName}/tables/{decisionName}")
    public Map<String, Object> getDecisionTable(@PathVariable("modelName") String modelName, @PathVariable("decisionName") String decisionName) {
        try {
            org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
            org.springframework.core.io.Resource[] resources = resolver.getResources("classpath*:**/*.dmn");
            for (org.springframework.core.io.Resource r : resources) {
                try (java.io.InputStream is = r.getInputStream()) {
                    javax.xml.parsers.DocumentBuilderFactory dbFactory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    dbFactory.setNamespaceAware(true);
                    javax.xml.parsers.DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
                    org.w3c.dom.Document doc = dBuilder.parse(is);
                    org.w3c.dom.Element defs = doc.getDocumentElement();
                    String name = defs.getAttribute("name");
                    if (name == null) name = "";
                    if (!name.equalsIgnoreCase(modelName)) continue;

                    org.w3c.dom.NodeList decs = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decision");
                    for (int i = 0; i < decs.getLength(); i++) {
                        org.w3c.dom.Element dec = (org.w3c.dom.Element) decs.item(i);
                        String dname = dec.getAttribute("name");
                        if (!decisionName.equalsIgnoreCase(dname)) continue;

                        org.w3c.dom.NodeList dtList = dec.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decisionTable");
                        if (dtList.getLength() == 0) {
                            Map<String, Object> out = new HashMap<>();
                            out.put("name", dname);
                            out.put("decisionTableXml", null);
                            out.put("parsed", Collections.emptyMap());
                            return out;
                        }
                        org.w3c.dom.Element dt = (org.w3c.dom.Element) dtList.item(0);

                        // serialize dt to XML string
                        javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
                        javax.xml.transform.Transformer transformer = tf.newTransformer();
                        transformer.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION, "yes");
                        java.io.StringWriter writer = new java.io.StringWriter();
                        transformer.transform(new javax.xml.transform.dom.DOMSource(dt), new javax.xml.transform.stream.StreamResult(writer));
                        String dtXml = writer.toString();

                        // parse a simple structured representation
                        List<String> inputs = new ArrayList<>();
                        List<String> outputs = new ArrayList<>();
                        org.w3c.dom.NodeList inputNodes = dt.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "input");
                        for (int j = 0; j < inputNodes.getLength(); j++) {
                            org.w3c.dom.Element in = (org.w3c.dom.Element) inputNodes.item(j);
                            org.w3c.dom.NodeList ie = in.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "inputExpression");
                            String label = in.getAttribute("label");
                            // If label attribute is missing, try to extract the expression text
                            if ((label == null || label.isEmpty()) && ie.getLength() > 0) {
                                org.w3c.dom.Element ieEl = (org.w3c.dom.Element) ie.item(0);
                                // Prefer a nested <text> child if present
                                org.w3c.dom.NodeList textNodes = ieEl.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "text");
                                if (textNodes != null && textNodes.getLength() > 0) {
                                    label = textNodes.item(0).getTextContent();
                                } else {
                                    // fallback to the element's text content (covers inline text nodes)
                                    String t = ieEl.getTextContent();
                                    if (t != null) label = t.trim();
                                }
                            }
                            // Final fallbacks: input 'name' or variable name
                            if (label == null || label.isEmpty()) {
                                String inName = in.getAttribute("name");
                                if (inName != null && !inName.isEmpty()) {
                                    label = inName;
                                } else {
                                    org.w3c.dom.NodeList varNodes2 = in.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "variable");
                                    if (varNodes2.getLength() > 0) {
                                        org.w3c.dom.Element varEl = (org.w3c.dom.Element) varNodes2.item(0);
                                        String varName = varEl.getAttribute("name");
                                        if (varName != null && !varName.isEmpty()) label = varName;
                                    }
                                }
                            }
                            inputs.add(label == null ? "" : label);
                        }
                        org.w3c.dom.NodeList outputNodes = dt.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "output");
                        for (int j = 0; j < outputNodes.getLength(); j++) {
                            org.w3c.dom.Element outEl = (org.w3c.dom.Element) outputNodes.item(j);
                            outputs.add(outEl.getAttribute("name"));
                        }

                        // rules
                        List<Map<String, Object>> rules = new ArrayList<>();
                        org.w3c.dom.NodeList ruleNodes = dt.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "rule");
                        for (int rIdx = 0; rIdx < ruleNodes.getLength(); rIdx++) {
                            org.w3c.dom.Element ruleEl = (org.w3c.dom.Element) ruleNodes.item(rIdx);
                            org.w3c.dom.NodeList inEntries = ruleEl.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "inputEntry");
                            org.w3c.dom.NodeList outEntries = ruleEl.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "outputEntry");
                            List<String> inVals = new ArrayList<>();
                            for (int ii = 0; ii < inEntries.getLength(); ii++) {
                                org.w3c.dom.Element ie = (org.w3c.dom.Element) inEntries.item(ii);
                                inVals.add(ie.getTextContent().trim());
                            }
                            List<String> outVals = new ArrayList<>();
                            for (int oi = 0; oi < outEntries.getLength(); oi++) {
                                org.w3c.dom.Element oe = (org.w3c.dom.Element) outEntries.item(oi);
                                outVals.add(oe.getTextContent().trim());
                            }
                            Map<String, Object> rmap = new HashMap<>();
                            rmap.put("inputs", inVals);
                            rmap.put("outputs", outVals);
                            rules.add(rmap);
                        }

                        Map<String, Object> out = new HashMap<>();
                        out.put("name", dname);
                        out.put("decisionTableXml", dtXml);
                        Map<String, Object> parsed = new HashMap<>();
                        parsed.put("inputs", inputs);
                        parsed.put("outputs", outputs);
                        parsed.put("rules", rules);
                        out.put("parsed", parsed);
                        return out;
                    }
                } catch (Exception e) {
                    logger.warn("Failed reading DMN resource for decision {}: {}", r.getFilename(), e.getMessage());
                }
            }
            throw new RuntimeException("Decision not found: " + decisionName + " in model " + modelName);
        } catch (Exception e) {
            logger.error("Error fetching decision table {} for {}: {}", decisionName, modelName, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    @PutMapping("/models/{modelName}/tables/{decisionName}")
    public Map<String, Object> updateDecisionTable(@PathVariable("modelName") String modelName,
                                                   @PathVariable("decisionName") String decisionName,
                                                   @RequestBody Map<String, Object> body) {
        Object dtObj = body.get("decisionTableXml");
        String dtXml = dtObj == null ? null : dtObj.toString();
        if (dtXml == null) throw new IllegalArgumentException("decisionTableXml is required in body");
        Object testCasesObj = body.get("testCases");
        try {
            org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
            org.springframework.core.io.Resource[] resources = resolver.getResources("classpath*:**/*.dmn");
            org.springframework.core.io.Resource targetResource = null;
            org.w3c.dom.Document targetDoc = null;
            for (org.springframework.core.io.Resource r : resources) {
                try (java.io.InputStream is = r.getInputStream()) {
                    javax.xml.parsers.DocumentBuilderFactory dbFactory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
                    dbFactory.setNamespaceAware(true);
                    javax.xml.parsers.DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
                    org.w3c.dom.Document doc = dBuilder.parse(is);
                    org.w3c.dom.Element defs = doc.getDocumentElement();
                    String name = defs.getAttribute("name");
                    if (name == null) name = "";
                    if (!name.equalsIgnoreCase(modelName)) continue;

                    org.w3c.dom.NodeList decs = doc.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decision");
                    for (int i = 0; i < decs.getLength(); i++) {
                        org.w3c.dom.Element dec = (org.w3c.dom.Element) decs.item(i);
                        String dname = dec.getAttribute("name");
                        if (!decisionName.equalsIgnoreCase(dname)) continue;
                        // found decision
                        targetResource = r;
                        // parse the provided dtXml into an Element
                        javax.xml.parsers.DocumentBuilder dtBuilder = dbFactory.newDocumentBuilder();
                        org.w3c.dom.Document dtDoc = dtBuilder.parse(new org.xml.sax.InputSource(new java.io.StringReader(dtXml)));
                        org.w3c.dom.Element newDt = dtDoc.getDocumentElement();

                        // import node into original doc
                        org.w3c.dom.Node imported = doc.importNode(newDt, true);
                        org.w3c.dom.NodeList oldDtList = dec.getElementsByTagNameNS("http://www.omg.org/spec/DMN/20180521/MODEL/", "decisionTable");
                        if (oldDtList.getLength() > 0) {
                            org.w3c.dom.Node old = oldDtList.item(0);
                            dec.replaceChild(imported, old);
                        } else {
                            dec.appendChild(imported);
                        }

                        targetDoc = doc;
                        break;
                    }
                    if (targetDoc != null) break;
                } catch (Exception e) {
                    logger.warn("Failed processing DMN resource for update {}: {}", r.getFilename(), e.getMessage());
                }
            }

            if (targetResource == null || targetDoc == null) {
                throw new RuntimeException("Decision not found to update: " + decisionName + " in model " + modelName);
            }

            // Attempt to write back to underlying file if possible
            try {
                java.io.File f = targetResource.getFile();
                if (f != null && f.exists() && f.canWrite()) {
                    // create a timestamped backup first
                    try {
                        java.io.File backup = new java.io.File(f.getAbsolutePath() + "." + System.currentTimeMillis() + ".bak");
                        java.nio.file.Files.copy(f.toPath(), backup.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        logger.info("Created DMN backup: {}", backup.getAbsolutePath());
                    } catch (Exception ex) {
                        logger.warn("Failed to create DMN backup: {}", ex.getMessage());
                    }

                    javax.xml.transform.TransformerFactory tf = javax.xml.transform.TransformerFactory.newInstance();
                    javax.xml.transform.Transformer transformer = tf.newTransformer();
                    transformer.setOutputProperty(javax.xml.transform.OutputKeys.INDENT, "yes");
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
                    transformer.transform(new javax.xml.transform.dom.DOMSource(targetDoc), new javax.xml.transform.stream.StreamResult(fos));
                    fos.close();
                    logger.info("Updated DMN source file: {}", f.getAbsolutePath());
                    // If testCases were provided, persist them to a sidecar JSON next to the DMN file
                    if (testCasesObj != null) {
                        try {
                            ObjectMapper mapper = new ObjectMapper();
                            String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(testCasesObj);
                            java.io.File sidecar = new java.io.File(f.getParentFile(), f.getName() + "." + decisionName + ".testcases.json");
                            try (java.io.FileWriter fw = new java.io.FileWriter(sidecar)) {
                                fw.write(json);
                            }
                            logger.info("Wrote testCases sidecar: {}", sidecar.getAbsolutePath());
                        } catch (Exception ex) {
                            logger.warn("Failed to write testCases sidecar: {}", ex.getMessage());
                        }
                    }
                } else {
                    logger.warn("DMN resource is not a writable file; update will be applied to runtime only: {}", targetResource.getFilename());
                    // even if DMN file isn't writable, attempt to persist testCases next to resource if possible
                    try {
                        java.io.File parent = targetResource.getFile().getParentFile();
                        if (parent != null && parent.canWrite() && testCasesObj != null) {
                            ObjectMapper mapper = new ObjectMapper();
                            String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(testCasesObj);
                            java.io.File sidecar = new java.io.File(parent, targetResource.getFilename() + "." + decisionName + ".testcases.json");
                            try (java.io.FileWriter fw = new java.io.FileWriter(sidecar)) {
                                fw.write(json);
                            }
                            logger.info("Wrote testCases sidecar (non-writable DMN): {}", sidecar.getAbsolutePath());
                        }
                    } catch (Exception ex) {
                        logger.warn("Could not persist testCases sidecar for non-writable DMN resource: {}", ex.getMessage());
                    }
                }
            } catch (Exception e) {
                logger.warn("Failed to write DMN file to disk: {}", e.getMessage());
            }

            // Rebuild KIE module in-memory using KieFileSystem so runtime picks up updated DMN
            try {
                org.kie.api.KieServices ks = org.kie.api.KieServices.Factory.get();
                org.kie.api.builder.KieFileSystem kfs = ks.newKieFileSystem();

                // write all DMN resources found on classpath into kfs
                org.springframework.core.io.support.PathMatchingResourcePatternResolver resolver2 = new org.springframework.core.io.support.PathMatchingResourcePatternResolver();
                org.springframework.core.io.Resource[] allResources = resolver2.getResources("classpath*:**/*.dmn");
                for (org.springframework.core.io.Resource rr : allResources) {
                    try (java.io.InputStream is = rr.getInputStream()) {
                        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[4096];
                        int rlen;
                        while ((rlen = is.read(buf)) != -1) {
                            baos.write(buf, 0, rlen);
                        }
                        byte[] bytes = baos.toByteArray();
                        // try to compute a path under src/main/resources
                        String writePath = "src/main/resources/" + rr.getFilename();
                        try {
                            String uri = rr.getURI().getPath();
                            int idx = uri.indexOf("src/main/resources");
                            if (idx >= 0) writePath = uri.substring(idx + "src/main/resources/".length());
                        } catch (Exception ex) {
                            // fallback to filename
                        }
                        // ensure path starts with src/main/resources/
                        if (!writePath.startsWith("src/main/resources/")) writePath = "src/main/resources/" + writePath;
                        kfs.write(writePath, bytes);
                    } catch (Exception e) {
                        logger.warn("Failed to read DMN resource when building KieFileSystem {}: {}", rr.getFilename(), e.getMessage());
                    }
                }

                org.kie.api.builder.KieBuilder kb = ks.newKieBuilder(kfs).buildAll();
                org.kie.api.builder.Results results = kb.getResults();
                if (results.hasMessages(org.kie.api.builder.Message.Level.ERROR)) {
                    StringBuilder sb = new StringBuilder();
                    results.getMessages().forEach(m -> sb.append(m.toString()).append("\n"));
                    logger.error("KieBuilder errors: {}", sb.toString());
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("status", "build_failed");
                    resp.put("errors", sb.toString());
                    return resp;
                }

                org.kie.api.builder.KieModule km = kb.getKieModule();
                org.kie.api.builder.ReleaseId rid = km.getReleaseId();
                org.kie.api.runtime.KieContainer newContainer = ks.newKieContainer(rid);
                // replace the controller's kieContainer so subsequent calls use updated rules
                this.kieContainer = newContainer;
                logger.info("Rebuilt and replaced KieContainer with releaseId {}", rid);
            } catch (Exception e) {
                logger.error("Failed to rebuild KIE runtime: {}", e.getMessage(), e);
                Map<String, Object> resp = new HashMap<>();
                resp.put("status", "rebuild_failed");
                resp.put("error", e.getMessage());
                return resp;
            }

            Map<String, Object> ok = new HashMap<>();
            ok.put("status", "ok");
            ok.put("model", modelName);
            ok.put("decision", decisionName);
            return ok;

        } catch (Exception e) {
            logger.error("Error updating decision table {} for {}: {}", decisionName, modelName, e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }
}
