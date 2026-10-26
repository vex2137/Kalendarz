package com.kalendarz.offline;
import org.junit.Test;
import static org.junit.Assert.*;
public class ModelIdentityTest {
    @Test public void acceptsEveryPublishedCatalogueIdentity() {
        for(String id:new String[]{"kalendarz-qwen35-v2-q4-k-m","qwen3.5-0.8b-q4-k-m","qwen3.5-0.8b-iq4-xs","lfm2.5-350m-q4-k-m","lfm2.5-2.6b-q4-k-m"})assertTrue(id,ModelIdentity.valid(id));
        assertTrue(ModelIdentity.valid("imported-"+"a".repeat(64)));
    }
    @Test public void rejectsPathsAndTraversalWithoutRejectingVersionDots() {
        for(String id:new String[]{"",".","..","../weights","a/weights","a\\weights","a..b","/etc/passwd","A","a".repeat(91)})assertFalse(id,ModelIdentity.valid(id));
        assertFalse(ModelIdentity.valid(null));
    }
}
